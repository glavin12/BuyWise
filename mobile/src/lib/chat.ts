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
export type ToolChange = { kind: "transaction" | "budget" | "goal" } | { kind: "payee"; type: "expense" | "income" };

// The tools that write. add_transaction can create a payee of either type.
const TOOL_CHANGES = new Map<string, ToolChange[]>([
  ["add_transaction", [{ kind: "transaction" }, { kind: "payee", type: "expense" }, { kind: "payee", type: "income" }]],
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
