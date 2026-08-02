# Design Decisions

Rationale behind the non-obvious choices. Read this when you're about to change something and want to understand why it is the way it is — or when a decision looks worth revisiting.

---

## 1. Access control lives in the repository layer, not RLS

**Decision:** Every repository method that reads or writes a conversation or message filters by `user_id`; Supabase RLS is treated as irrelevant to the service.

**Why:** The AI service connects to Postgres through its own SQLAlchemy session as the DB superuser, so RLS policies are bypassed and provide zero protection for these queries. Relying on them would be security theater. The repository layer is the only boundary the service actually enforces, so that's where the checks live. RLS policies still exist in the schema for other access paths (e.g. PostgREST), but the service never depends on them.

**Consequence:** A `user_id` filter is **never** removable from a repository method without reintroducing a data leak.

---

## 2. `user_id` is required on every conversation

**Decision:** `conversations.user_id` is `NOT NULL`; `/api/v1/chat` requires `user_id`.

**Why:** Persistent memory is per-user. An earlier experiment made `user_id` nullable to support anonymous chat, but that directly contradicts decision #1 — you can't enforce `user_id` scoping when `user_id` can be absent. Reverted to required in `202608020002`.

**Consequence:** Every chat request must carry the owning user's id; there is no anonymous/guest mode.

---

## 3. UUIDv7 generated in the application layer

**Decision:** Primary keys are `UUID`, populated by `generate_uuid7()` (Python, via `uuid-utils`) before insert.

**Why:** `uuidv7()` is a Postgres 18 feature; the target Supabase runs Postgres 17.6. Rather than a version check or a heavy `bigserial + public_id` split, the value is produced in the app and stored in a plain UUID column — time-sortable, works on any Postgres version, and is future-proof if we later switch to native `uuidv7()`.

**Consequence:** The DB cannot be the only writer that generates ids; the app always supplies them.

---

## 4. Tool calls are persisted as data, not flattened text

**Decision:** Assistant rows store `tool_calls` as JSONB (`{name, args, id}`) exactly mirroring LangChain's `AIMessage.tool_calls`; paired `role='tool'` rows store the stringified output and `tool_call_id`. `db_messages_to_langchain` rebuilds the exact sequence and asserts the pairing on every load.

**Why:** `create_react_agent` expects `AIMessage(tool_calls)` immediately followed by its `ToolMessage`s. If a reload emits an unpaired `ToolMessage` (or one in the wrong position), the model API rejects the request outright. Storing the structural shape — not a blob of text — makes round-tripping lossless, and the assertion turns a late, confusing API error into a fast, local one.

**Consequence:** A `tool` row may never exist without its assistant parent in history; that invariant is enforced by atomic saves (decision #5).

---

## 5. Assistant turns are persisted atomically

**Decision:** `save_assistant_turn` writes the intermediate assistant(`tool_calls`) rows, their tool rows, and the final assistant text row **in order in one commit**.

**Why:** Partial persistence would leave orphaned `tool` rows or a broken sequence, which would corrupt every subsequent reload and trip the pairing assertion. One commit means a reload either sees the full turn or none of it.

**Consequence:** A crash mid-persist loses an entire turn rather than corrupting history.

---

## 6. Exactly-once via the unique index, not check-then-insert

**Decision:** A partial unique index on `idempotency_key WHERE idempotency_key IS NOT NULL` enforces exactly-once sends; `MessageRepository.create` catches the `IntegrityError` inside a SAVEPOINT and returns the existing row instead of doing a lookup-then-insert.

**Why:** Check-then-insert has a race window: two concurrent retries can both pass the check and both insert. The unique index closes the race at the database. The SAVEPOINT confines the failed insert so the outer transaction isn't aborted.

**Consequence:** The idempotency key is the only dedup mechanism; keys are scoped to a user at read time but unique globally at write time (collisions across users are effectively impossible with UUID keys).

---

## 7. Soft deletes + `ON DELETE RESTRICT`

**Decision:** `conversations.deleted_at` and `messages.deleted_at` for soft deletes; the `messages.conversation_id` FK is `ON DELETE RESTRICT`.

**Why:** Conversations are never physically deleted in this phase — `DELETE /api/v1/conversations` sets `deleted_at` so history can be restored or audited later. With soft deletes as the only deletion path, a hard `CASCADE` on the FK would be a foot-gun; `RESTRICT` makes an accidental destructive delete fail loudly instead of silently wiping message rows.

**Consequence:** Physical deletion requires an explicit, intentional migration/script.

---

## 8. Agent failure → 200 with a `status='failed'` row

**Decision:** When the agent call fails, the endpoint returns `200` with an apology message and persists a single `status='failed'` assistant row (error details in `metadata`).

**Why:** A transient provider/model failure shouldn't surface as an HTTP 5xx that breaks the client's message loop; the failed turn is recorded in history so it's visible and auditable. The client retries with a **fresh** `idempotency_key` to get a new attempt (replaying the same key would replay the failure).

**Consequence:** `status='failed'` rows are part of normal history and must not be assumed to be retryable via the same key.

---

## 9. System prompt is code, not a DB row

**Decision:** `SYSTEM_PROMPT` lives in `ai_service/services/agent_service.py` and is injected fresh by the agent on every invocation; there is no `system` message row used at runtime.

**Why:** A prompt fix must apply to every conversation immediately. If prompts were persisted per-conversation, existing conversations would stay frozen on stale instructions until their rows are migrated.

**Consequence:** `role='system'` rows are never written; `db_messages_to_langchain` skips them defensively if they ever appear.

---

## 10. Context window is a fixed message cap

**Decision:** `get_recent_messages` caps history at `settings.MAX_CONVERSATION_HISTORY` (20) messages; the cap is a single config constant.

**Why:** Prevents a long conversation from silently exceeding the model's context window. Not summarization or token-aware yet — those are Phase 2/4 work. The constant is the single swap point for a token-based cap once `total_tokens` data is reliable.

**Consequence:** Reload context is strictly the last N messages; earlier turns exist only in the DB and the UI history endpoint.

---

## 11. `metadata` DB column vs. reserved ORM attribute

**Decision:** The JSONB column is named `metadata` in the database; the ORM attribute is `message_metadata` (mapped via `mapped_column("metadata", ...)`).

**Why:** `metadata` is a reserved name in SQLAlchemy's Declarative API (it's the `MetaData` on the base class), so a Python attribute of that name cannot be declared. The DB column name stays per spec; only the attribute is renamed.

**Consequence:** Raw SQL and ORM code refer to the column differently — ORM code must use `message_metadata`.
