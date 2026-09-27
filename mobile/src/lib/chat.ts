import type { Conversation, Message, ToolCall } from "./types.ts";

// Pure chat helpers: grouping the History list, which rows become bubbles, and
// which caches an AI reply made stale.

export type ConversationSection = { title: "Today" | "This week" | "Older"; data: Conversation[] };

const DAY_MS = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today / This week / Older by the phone's calendar, keeping the server's order inside each group. Empty groups are left out. */
export function groupConversations(list: readonly Conversation[], now: Date): ConversationSection[] {
  const sections: ConversationSection[] = [
    { title: "Today", data: [] },
    { title: "This week", data: [] },
    { title: "Older", data: [] },
  ];
  for (const c of list) {
    // Rounded: a day across a DST change is 23 or 25 hours long.
    const days = Math.round((dayStart(now) - dayStart(new Date(c.last_message_at ?? c.created_at))) / DAY_MS);
    sections[days <= 0 ? 0 : days < 7 ? 1 : 2].data.push(c);
  }
  return sections.filter((s) => s.data.length > 0);
}

/** Rows shown as bubbles: tool and system rows, and assistant rows that only carried tool calls, are hidden. */
export function visibleMessages(messages: readonly Message[]): Message[] {
  return messages.filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim() !== ""));
}

export function prettyToolName(name: string): string {
  return name
    .replace(/^tool_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Structurally a `Change` from queries.ts (which this file cannot import and stay testable). */
export type ToolChange = { kind: "transaction" | "budget" | "goal" | "payee" };

// The tools that write. add_transaction can create a payee.
const TOOL_CHANGES = new Map<string, ToolChange[]>([
  ["add_transaction", [{ kind: "transaction" }, { kind: "payee" }]],
  ["set_category_budget", [{ kind: "budget" }]],
  ["add_goal", [{ kind: "goal" }]],
  ["update_goal_progress", [{ kind: "goal" }]],
]);

/** What a reply's tool calls made stale, each change once. */
export function changesFromTools(toolCalls: readonly Pick<ToolCall, "tool_name">[]): ToolChange[] {
  const changes = new Map<string, ToolChange>();
  for (const call of toolCalls) {
    for (const change of TOOL_CHANGES.get(call.tool_name) ?? []) changes.set(JSON.stringify(change), change);
  }
  return [...changes.values()];
}

/** One per new send (a retry reuses it). The server accepts any string up to 128 characters. */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The empty-chat suggestions' first entry, personalised from cached query data
 * only (see ChatThread — no network call here). No transactions beats no budget.
 */
export function firstSuggestionOverride(hasTransactions: boolean | undefined, hasBudget: boolean | undefined): string | null {
  if (hasTransactions === false) return "Help me add my first expense";
  if (hasBudget === false) return "Help me set up a budget";
  return null;
}

// AI9: readable tool cards. toolSummary parses tool_output (JSON from the Python
// tools; see ai_service/tools/*.py and the services they call) for the tools this
// covers, and money is formatted from the output's own display_* float — never
// re-derived by hand. Not importing format.ts: it imports ./dates without a .ts
// extension, so it can't run under `node --test` (rule 6).
const CURRENCY_LOCALE: Record<string, string> = { INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB" };

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function money(display: unknown, currency: unknown = "INR"): string | null {
  const amount = asNumber(display);
  if (amount === null) return null;
  const cur = asString(currency) ?? "INR";
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[cur] ?? "en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${cur} ${amount}`;
  }
}
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** A short human summary of a tool call's output, for the card's collapsed header. Falls back to `prettyToolName` on an error shape, an unknown tool, or JSON that doesn't parse. */
export function toolSummary(call: Pick<ToolCall, "tool_name" | "tool_output">): string {
  const fallback = prettyToolName(call.tool_name);
  let parsed: unknown;
  try {
    parsed = JSON.parse(call.tool_output);
  } catch {
    return fallback;
  }
  const o = asRecord(parsed);
  if (!o) return fallback;

  switch (call.tool_name) {
    case "add_transaction": {
      const amount = money(o.display_amount, o.currency);
      const type = asString(o.transaction_type);
      if (amount && type === "expense") return `Added ${amount} to ${asString(o.category) ?? "an expense"}`;
      if (amount && type === "income") {
        const category = asString(o.category);
        return `Added ${amount} income${category ? ` · ${category}` : ""}`;
      }
      if (amount && type === "starting_balance") return `Set starting balance to ${amount}`;
      break;
    }
    case "set_category_budget": {
      const amount = money(o.display_budgeted_amount);
      const category = asString(o.category);
      if (amount && category) return `Budget for ${category} set to ${amount}`;
      break;
    }
    case "add_goal": {
      const title = asString(o.title);
      const target = money(o.display_target_amount);
      if (title && target) return `Created goal "${title}" · target ${target}`;
      break;
    }
    case "update_goal_progress": {
      const title = asString(o.title);
      const current = money(o.display_current_amount);
      const target = money(o.display_target_amount);
      const percent = asNumber(o.progress_percent);
      if (title && current && target && percent !== null) return `"${title}" now at ${current} of ${target} (${percent}%)`;
      break;
    }
    case "get_dashboard": {
      const balance = money(o.display_current_balance);
      const spent = money(o.display_total_spent);
      if (balance && spent) return `Balance is ${balance} · ${spent} spent this month`;
      break;
    }
    case "get_recent_transactions": {
      const rows = Array.isArray(o.transactions) ? o.transactions.length : asNumber(o.count);
      if (rows !== null) return rows === 0 ? "No recent transactions" : plural(rows, "recent transaction");
      break;
    }
    case "get_budget_status": {
      if (o.has_budget === false) return "No budget set for this period";
      const spent = money(o.display_total_spent);
      const budgeted = money(o.display_total_budgeted);
      if (o.has_budget === true && spent && budgeted) return `${spent} spent of ${budgeted} budgeted`;
      break;
    }
    case "get_spending_breakdown": {
      const spent = money(o.display_total_spent);
      const count = asNumber(o.transaction_count);
      if (spent && count !== null) return `Spent ${spent} across ${plural(count, "transaction")}`;
      break;
    }
    case "get_income_summary": {
      const income = money(o.display_total_income);
      const count = asNumber(o.transaction_count);
      if (income && count !== null) return `${income} income across ${plural(count, "transaction")}`;
      break;
    }
    case "get_financial_goals": {
      const count = asNumber(o.count);
      const status = asString(o.status);
      if (count !== null) return count === 0 ? "No goals yet" : `${plural(count, "goal")}${status ? ` (${status})` : ""}`;
      break;
    }
    case "calculator": {
      const expr = asString(o.expression);
      const result = asNumber(o.result);
      if (expr && result !== null) return `${expr} = ${result}`;
      break;
    }
  }
  return fallback;
}
