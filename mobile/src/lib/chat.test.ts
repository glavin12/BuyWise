import assert from "node:assert/strict";
import { test } from "node:test";

import {
  changesFromTools,
  clockTime,
  firstSuggestionOverride,
  greeting,
  groupConversations,
  newIdempotencyKey,
  prettyToolName,
  prosePieces,
  splitFigures,
  toolSummary,
  visibleMessages,
} from "./chat.ts";
import type { Conversation, Message } from "./types.ts";

const conv = (id: string, last: string | null, created = "2026-01-01T00:00:00"): Conversation => ({
  id,
  user_id: "u",
  title: null,
  message_count: 1,
  last_message_at: last,
  created_at: created,
  updated_at: created,
});

test("groupConversations buckets by local calendar day and drops empty groups", () => {
  const now = new Date(2026, 8, 25, 0, 30); // just after local midnight
  const sections = groupConversations(
    [
      conv("a", new Date(2026, 8, 25, 0, 5).toISOString()),
      conv("b", new Date(2026, 8, 24, 23, 55).toISOString()), // 35 minutes ago, but yesterday
      conv("c", null, new Date(2026, 8, 19, 12).toISOString()), // falls back to created_at
      conv("d", new Date(2026, 8, 18, 12).toISOString()),
    ],
    now
  );
  assert.deepEqual(
    sections.map((s) => [s.title, s.data.map((c) => c.id)]),
    [
      ["Today", ["a"]],
      ["This week", ["b", "c"]],
      ["Older", ["d"]],
    ]
  );
  assert.deepEqual(groupConversations([], now), []);
});

test("visibleMessages hides tool, system and empty assistant rows", () => {
  const msg = (id: string, role: Message["role"], content: string): Message => ({
    id,
    role,
    content,
    tool_call_id: null,
    status: "completed",
    created_at: "",
  });
  const shown = visibleMessages([
    msg("1", "user", "hi"),
    msg("2", "assistant", "  "),
    msg("3", "tool", "{}"),
    msg("4", "system", "x"),
    msg("5", "assistant", "hello"),
  ]);
  assert.deepEqual(
    shown.map((m) => m.id),
    ["1", "5"]
  );
});

test("prettyToolName", () => {
  assert.equal(prettyToolName("get_budget_status"), "Get Budget Status");
  assert.equal(prettyToolName("tool_add_goal"), "Add Goal");
});

test("changesFromTools maps writing tools once each and ignores the rest", () => {
  const calls = ["get_dashboard", "add_goal", "update_goal_progress", "set_category_budget", "constructor"].map((tool_name) => ({ tool_name }));
  assert.deepEqual(changesFromTools(calls), [{ kind: "goal" }, { kind: "budget" }]);
  assert.deepEqual(changesFromTools([{ tool_name: "add_transaction" }]), [{ kind: "transaction" }, { kind: "payee" }]);
  assert.deepEqual(changesFromTools([]), []);
});

test("newIdempotencyKey is unique and within the server's limit", () => {
  const a = newIdempotencyKey();
  assert.notEqual(a, newIdempotencyKey());
  assert.ok(a.length <= 128);
});

test("firstSuggestionOverride: no transactions beats no budget, unknowns are skipped", () => {
  assert.equal(firstSuggestionOverride(undefined, undefined), null);
  assert.equal(firstSuggestionOverride(false, undefined), "Help me add my first expense");
  assert.equal(firstSuggestionOverride(false, true), "Help me add my first expense"); // transactions rule wins
  assert.equal(firstSuggestionOverride(true, false), "Help me set up a budget");
  assert.equal(firstSuggestionOverride(true, true), null);
  assert.equal(firstSuggestionOverride(undefined, false), "Help me set up a budget");
});

// Shapes below mirror what the Python tools actually return (ai_service/tools/*.py
// and the services they call), so a real tool_output round-trips through JSON.parse.
const call = (tool_name: string, output: unknown) => ({ tool_name, tool_output: JSON.stringify(output) });

test("toolSummary: add_transaction", () => {
  assert.equal(
    toolSummary(call("add_transaction", { transaction_type: "expense", category: "Food & Dining", amount: 124000, display_amount: 1240, currency: "INR" })),
    "Added ₹1,240 to Food & Dining"
  );
  assert.equal(
    toolSummary(call("add_transaction", { transaction_type: "income", category: "Salary", display_amount: 5000, currency: "INR" })),
    "Added ₹5,000 income · Salary"
  );
  assert.equal(
    toolSummary(call("add_transaction", { transaction_type: "income", category: null, display_amount: 5000, currency: "INR" })),
    "Added ₹5,000 income"
  );
  assert.equal(
    toolSummary(call("add_transaction", { transaction_type: "starting_balance", display_amount: 10000, currency: "INR" })),
    "Set starting balance to ₹10,000"
  );
});

test("toolSummary formats the amounts that carry no currency in the profile's currency", () => {
  const budget = call("set_category_budget", { category: "Food", month: 9, year: 2026, budgeted_amount: 500000, display_budgeted_amount: 5000 });
  assert.equal(toolSummary(budget), "Budget for Food set to ₹5,000"); // INR unless told otherwise
  assert.equal(toolSummary(budget, "USD"), "Budget for Food set to $5,000");
  // add_transaction reports its own currency, which wins over the profile's.
  const added = call("add_transaction", { transaction_type: "expense", category: "Food", display_amount: 12, currency: "EUR" });
  assert.equal(toolSummary(added, "USD"), "Added 12 € to Food"); // de-DE puts a no-break space before the €
});

test("toolSummary: set_category_budget, add_goal, update_goal_progress", () => {
  assert.equal(
    toolSummary(call("set_category_budget", { category: "Food", month: 9, year: 2026, budgeted_amount: 500000, display_budgeted_amount: 5000 })),
    "Budget for Food set to ₹5,000"
  );
  assert.equal(
    toolSummary(call("add_goal", { title: "Emergency Fund", display_target_amount: 50000, status: "active" })),
    'Created goal "Emergency Fund" · target ₹50,000'
  );
  assert.equal(
    toolSummary(call("update_goal_progress", { title: "Emergency Fund", display_current_amount: 12000, display_target_amount: 50000, progress_percent: 24 })),
    '"Emergency Fund" now at ₹12,000 of ₹50,000 (24%)'
  );
});

test("toolSummary: reads — dashboard, recent transactions, budget status, spending, income, goals, calculator", () => {
  assert.equal(
    toolSummary(call("get_dashboard", { display_current_balance: 12500, display_total_spent: 3400 })),
    "Balance is ₹12,500 · ₹3,400 spent this month"
  );
  assert.equal(toolSummary(call("get_recent_transactions", { count: 2, transactions: [{}, {}] })), "2 recent transactions");
  assert.equal(toolSummary(call("get_recent_transactions", { count: 0, transactions: [] })), "No recent transactions");
  assert.equal(
    toolSummary(call("get_budget_status", { has_budget: true, display_total_spent: 8000, display_total_budgeted: 10000 })),
    "₹8,000 spent of ₹10,000 budgeted"
  );
  assert.equal(toolSummary(call("get_budget_status", { has_budget: false })), "No budget set for this period");
  assert.equal(
    toolSummary(call("get_spending_breakdown", { display_total_spent: 4500, transaction_count: 12 })),
    "Spent ₹4,500 across 12 transactions"
  );
  assert.equal(
    toolSummary(call("get_income_summary", { display_total_income: 60000, transaction_count: 1 })),
    "₹60,000 income across 1 transaction"
  );
  assert.equal(toolSummary(call("get_financial_goals", { status: "active", count: 3 })), "3 goals (active)");
  assert.equal(toolSummary(call("get_financial_goals", { status: "active", count: 0 })), "No goals yet");
  assert.equal(toolSummary(call("calculator", { expression: "1500 + 2300", result: 3800, status: "success" })), "1500 + 2300 = 3800");
});

test("toolSummary falls back to prettyToolName on an error shape, bad JSON, or an unknown tool", () => {
  assert.equal(
    toolSummary(call("add_transaction", { status: "error", message: "Category 'Foo' not found." })),
    prettyToolName("add_transaction")
  );
  assert.equal(toolSummary({ tool_name: "get_dashboard", tool_output: "not json" }), prettyToolName("get_dashboard"));
  assert.equal(toolSummary(call("some_unregistered_tool", { ok: true })), prettyToolName("some_unregistered_tool"));
});

test("greeting names the first word of the name, or just says Hi", () => {
  assert.equal(greeting("Bhagy Patel"), "Hi, Bhagy. Ask me anything about your money.");
  assert.equal(greeting("  Asha  "), "Hi, Asha. Ask me anything about your money.");
  assert.equal(greeting("  "), "Hi. Ask me anything about your money.");
  assert.equal(greeting(null), "Hi. Ask me anything about your money.");
});

test("clockTime is a lower-case 12-hour clock, empty for a bad timestamp", () => {
  assert.equal(clockTime(new Date(2026, 8, 29, 21, 41)), "9:41 pm");
  assert.equal(clockTime(new Date(2026, 8, 29, 0, 5)), "12:05 am");
  assert.equal(clockTime(new Date(2026, 8, 29, 12, 0)), "12:00 pm");
  assert.equal(clockTime(new Date(2026, 8, 29, 9, 3).toISOString()), "9:03 am");
  assert.equal(clockTime("not a date"), "");
});

// The chip a figure gets, written inline: "[kind text]".
const marked = (text: string, symbols: readonly string[] = ["₹"]) =>
  splitFigures(text, symbols)
    .map((s) => (s.chip ? `[${s.chip} ${s.text}]` : s.text))
    .join("");

test("splitFigures chips amounts and percentages and leaves the rest as text", () => {
  assert.equal(marked("You spent ₹6,300 on food, 79% of ₹8,000."), "You spent [dark ₹6,300] on food, [dark 79%] of [dark ₹8,000].");
  assert.equal(
    marked("₹1,24,860.50 and ₹1,240,500 and ₹300 and ₹0.5"),
    "[dark ₹1,24,860.50] and [dark ₹1,240,500] and [dark ₹300] and [dark ₹0.5]"
  );
  assert.equal(marked("About 12.5% or 100%"), "About [dark 12.5%] or [dark 100%]");
  assert.equal(marked("Nothing here, 1,234,567 units, 14 orders"), "Nothing here, 1,234,567 units, 14 orders");
  assert.deepEqual(splitFigures("", ["₹"]), []);
});

test("splitFigures keeps the sentence's punctuation out of the chip", () => {
  assert.equal(marked("You spent ₹6,300."), "You spent [dark ₹6,300].");
  assert.equal(marked("₹6,300, then ₹5,000; ₹100)"), "[dark ₹6,300], then [dark ₹5,000]; [dark ₹100])");
  assert.equal(marked("₹5,000/month"), "[dark ₹5,000]/month");
});

test("splitFigures colours signed figures and reads a range's dash as text", () => {
  assert.equal(marked("Up +₹17,860, down −₹1,200 and -₹5 (+12.5%)"), "Up [mint +₹17,860], down [coral −₹1,200] and [coral -₹5] ([mint +12.5%])");
  assert.equal(marked("₹500-₹700 or 10-20%"), "[dark ₹500]-[dark ₹700] or 10-[dark 20%]");
});

test("splitFigures skips figures inside longer words and takes the symbols it is given", () => {
  assert.equal(marked("v2% abc₹5 x-₹5"), "v2% abc₹5 x-[dark ₹5]");
  assert.equal(marked("$12.50 and ₹5 and €3", ["₹", "$"]), "[dark $12.50] and [dark ₹5] and €3");
  assert.equal(marked("₹ 500 and ₹500"), "[dark ₹ 500] and [dark ₹500]");
  assert.equal(marked("$5, 50%", []), "$5, [dark 50%]");
  assert.equal(marked("CHF 12 (x)", ["CHF"]), "[dark CHF 12] (x)");
});

test("prosePieces lays a paragraph out as words and chips, keeping punctuation with its chip", () => {
  assert.deepEqual(prosePieces([{ text: "You spent ₹6,300 (79%). Done" }], ["₹"]), [
    { kind: "word", text: "You", marks: [], space: true },
    { kind: "word", text: "spent", marks: [], space: true },
    { kind: "chip", text: "₹6,300", chip: "hi", lead: "", trail: "", space: true }, // the first plain chip is the highlight
    { kind: "chip", text: "79%", chip: "dark", lead: "(", trail: ").", space: true },
    { kind: "word", text: "Done", marks: [], space: false },
  ]);
});

test("prosePieces carries marks and line breaks across runs, and is null without a figure", () => {
  assert.equal(prosePieces([{ text: "Nothing to see here." }, { text: "bold", marks: ["bold"] }], ["₹"]), null);
  assert.deepEqual(
    prosePieces([{ text: "Top: " }, { text: "Food", marks: ["bold"] }, { text: " ₹500" }, { text: "\n" }, { text: "Next" }], ["₹"]),
    [
      { kind: "word", text: "Top:", marks: [], space: true },
      { kind: "word", text: "Food", marks: ["bold"], space: true },
      { kind: "chip", text: "₹500", chip: "hi", lead: "", trail: "", space: false },
      { kind: "break" },
      { kind: "word", text: "Next", marks: [], space: false },
    ]
  );
});

test("prosePieces never chips plain (code) runs", () => {
  assert.deepEqual(prosePieces([{ text: "Use " }, { text: "₹500", marks: ["code"], plain: true }, { text: " and ₹5" }], ["₹"]), [
    { kind: "word", text: "Use", marks: [], space: true },
    { kind: "word", text: "₹500", marks: ["code"], space: true },
    { kind: "word", text: "and", marks: [], space: true },
    { kind: "chip", text: "₹5", chip: "hi", lead: "", trail: "", space: false },
  ]);
  assert.equal(prosePieces([{ text: "50%", marks: ["code"], plain: true }], ["₹"]), null);
});

test("prosePieces highlights only a plain first chip, and glues a range's dash to the chip before it", () => {
  assert.deepEqual(prosePieces([{ text: "-₹5 then ₹500-₹700" }], ["₹"]), [
    { kind: "chip", text: "-₹5", chip: "coral", lead: "", trail: "", space: true }, // signed: keeps its colour, and no other chip is promoted
    { kind: "word", text: "then", marks: [], space: true },
    { kind: "chip", text: "₹500", chip: "dark", lead: "", trail: "-", space: false },
    { kind: "chip", text: "₹700", chip: "dark", lead: "", trail: "", space: false },
  ]);
});
