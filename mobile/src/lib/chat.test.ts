import assert from "node:assert/strict";
import { test } from "node:test";

import { changesFromTools, groupConversations, newIdempotencyKey, prettyToolName, visibleMessages } from "./chat.ts";
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
  assert.deepEqual(changesFromTools([{ tool_name: "add_transaction" }]), [
    { kind: "transaction" },
    { kind: "payee", type: "expense" },
    { kind: "payee", type: "income" },
  ]);
  assert.deepEqual(changesFromTools([]), []);
});

test("newIdempotencyKey is unique and within the server's limit", () => {
  const a = newIdempotencyKey();
  assert.notEqual(a, newIdempotencyKey());
  assert.ok(a.length <= 128);
});
