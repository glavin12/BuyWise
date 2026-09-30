import type { ChipKind } from "./richText.ts";
import type { Conversation, Message, ToolCall } from "./types.ts";

// Pure chat helpers: grouping the History list, which rows become bubbles, which
// caches an AI reply made stale, the greeting and the figure chips in a reply.

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

// The new chat's greeting and the bubbles' clock: phone-side only, never saved or sent to the AI.

/** "Hi, Bhagy. Ask me anything about your money." (the name's first word; just "Hi." without a name). */
export function greeting(fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return `${first ? `Hi, ${first}.` : "Hi."} Ask me anything about your money.`;
}

/** "9:41 pm" for a bubble's "buddy · 9:41 pm"; empty when the timestamp does not parse. */
export function clockTime(at: Date | string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  if (isNaN(date.getTime())) return "";
  const hours = date.getHours();
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

// Figures in an AI reply become inline chips on the phone. This works on the text at render time,
// so old conversations get them too (nothing is stored). React Native cannot pad or round text
// nested in text, so a paragraph with a figure is laid out as a wrapping row of words and chips
// (like RichText does).

/** A piece of reply text: plain, or a figure the chat draws as an inline chip. */
export type FigureSegment = { text: string; chip?: ChipKind };

// 1,24,860 or 1,240,500 or 300, then an optional fraction. A comma group has 2 or 3 digits, so a number never ends in a comma.
const NUMBER = "(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?";
const isWordChar = (c: string | undefined) => c !== undefined && /\w/.test(c);

/**
 * Splits reply text into plain runs and figures: an amount written with one of `symbols` (`₹1,240.50`,
 * `$12`) or a percentage (`79%`). A leading + makes the chip mint, a - or − coral, none dark. A figure
 * inside a longer word (`v2%`) stays plain, and so does the dash of a range (`₹500-₹700`).
 */
export function splitFigures(text: string, symbols: readonly string[]): FigureSegment[] {
  const escaped = symbols.filter(Boolean).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const amount = escaped.length ? `(?:${escaped.join("|")})[ \\u00A0]?${NUMBER}|` : "";
  const figure = new RegExp(`([+\\-\\u2212]?)(?:${amount}${NUMBER}%)`, "g");
  const out: FigureSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(figure)) {
    let start = m.index;
    let sign = m[1];
    if (sign && isWordChar(text[start - 1])) {
      start += 1; // "₹500-₹700": that dash is a range, not a minus
      sign = "";
    } else if (!sign && isWordChar(text[start - 1])) {
      continue; // inside a longer word ("v2%")
    }
    if (start > last) out.push({ text: text.slice(last, start) });
    last = m.index + m[0].length;
    out.push({ text: text.slice(start, last), chip: sign === "+" ? "mint" : sign ? "coral" : "dark" });
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/**
 * Reply text with the styles it carries (`marks`: the caller's own names, "bold", "code", ...). `plain` text
 * (inline code) never gets chips. A run of "\n" is a line break.
 */
export type ProseRun = { text: string; marks?: readonly string[]; plain?: boolean };

/** One word or chip of a paragraph with figures. A chip keeps the punctuation typed against it (`lead`, `trail`), so a line never breaks inside "(79%).". */
export type ProsePiece =
  | { kind: "word"; text: string; marks: readonly string[]; space: boolean }
  | { kind: "chip"; text: string; chip: ChipKind; lead: string; trail: string; space: boolean }
  | { kind: "break" };

/**
 * A paragraph's words and figure chips in order, `space` saying whether whitespace follows. `null` when the
 * text has no figure: the caller then keeps its own flowing text (selectable across the paragraph). The
 * first chip, when it is a plain one, is the marigold highlight, as in the design.
 */
export function prosePieces(runs: readonly ProseRun[], symbols: readonly string[]): ProsePiece[] | null {
  const pieces: ProsePiece[] = [];
  for (const run of runs) {
    if (run.text === "\n") {
      pieces.push({ kind: "break" });
      continue;
    }
    const segments: FigureSegment[] = run.plain ? [{ text: run.text }] : splitFigures(run.text, symbols);
    for (const segment of segments) {
      const prev = pieces[pieces.length - 1];
      if (segment.chip) {
        const lead = prev?.kind === "word" && !prev.space ? prev.text : "";
        if (lead) pieces.pop();
        pieces.push({ kind: "chip", text: segment.text, chip: segment.chip, lead, trail: "", space: false });
        continue;
      }
      // Whitespace at the start of this text belongs after the previous piece.
      if (/^\s/.test(segment.text) && prev && prev.kind !== "break") prev.space = true;
      (segment.text.match(/\S+\s*/g) ?? []).forEach((chunk, i) => {
        const text = chunk.trimEnd();
        const space = text.length < chunk.length;
        const before = pieces[pieces.length - 1];
        if (i === 0 && before?.kind === "chip" && !before.space && !before.trail) {
          before.trail = text; // punctuation typed right after a chip goes with it
          before.space = space;
        } else {
          pieces.push({ kind: "word", text, marks: run.marks ?? [], space });
        }
      });
    }
  }
  for (const piece of pieces) {
    if (piece.kind !== "chip") continue;
    if (piece.chip === "dark") piece.chip = "hi";
    return pieces;
  }
  return null;
}
