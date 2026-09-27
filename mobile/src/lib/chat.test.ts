import assert from "node:assert/strict";
import { test } from "node:test";

import {
  changesFromTools,
  firstSuggestionOverride,
  groupConversations,
  newIdempotencyKey,
  prettyToolName,
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
