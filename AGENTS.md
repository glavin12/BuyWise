# AGENTS.md

# BuyWise AI Service

## Overview

BuyWise is an AI-first personal finance platform.

The AI is not just a chatbot. Its primary responsibility is to understand the user's financial situation, retrieve relevant information, use tools when necessary, and provide accurate financial assistance.

The project is built incrementally. Every feature must have a working foundation before additional intelligence is added.

---

# Current State (what is already built)

**Phase 1 — AI Chat Foundation is DONE, including persistent conversation memory.**

Shipped and verified against Supabase:

- FastAPI service (`ai_service/`) with layered architecture
- **Supabase Auth integration** (`ai_service/auth/`): Supabase is the sole authenticator; the backend only verifies Supabase-issued access JWTs (ES256/RS256 via JWKS) and derives the authenticated user as `CurrentUser`. No `user_id` is ever trusted from a request body/path/query.
- Development-only token helper `POST /api/v1/dev/token` (relays Supabase password grant) — registered only when `ENVIRONMENT=development`.
- LangChain `create_react_agent` agent with a system prompt and database-backed financial tools
- PostgreSQL (Supabase) persistence for `conversations` and `messages`
- **Persistent conversation memory**: prior messages reload into the agent on every request and survive a backend restart
- Tool-call round-tripping: assistant `tool_calls` and tool results are persisted and rebuilt on reload
- Exactly-once sends via client `idempotency_key`
- User-scoped access control at the repository layer (no RLS reliance), now backed by a verified JWT identity
- Soft deletes, message status tracking, token usage columns

Do not re-build any of this. Extend it.

---

# Architecture

Strict layered architecture. Data flows in one direction only:

```
Routes → Services → Repositories → SQLAlchemy → Postgres
```

- **Routes** (`ai_service/routers/`) — HTTP layer only. Parse/validate via Pydantic schemas, map exceptions to HTTP status codes, call services.
- **Services** (`ai_service/services/`) — business logic and orchestration. Own the chat flow, conversation lifecycle, and the agent interaction.
- **Repositories** (`ai_service/repositories/`) — ALL database access. Own every query; enforce `user_id` scoping.
- **Models** (`ai_service/models/`) — SQLAlchemy ORM classes.
- **Utils** (`ai_service/utils/`) — pure conversion helpers (e.g. DB rows → LangChain messages).

## Non-negotiable rules

1. **The AI never touches the database.** The agent only receives a list of LangChain messages and tool outputs. It never executes SQL and never accesses repositories directly.
2. **The repository layer is the security boundary.** Every repository method that reads or writes a conversation or message filters by `user_id`. **Do not rely on Supabase RLS** — the service connects via its own SQLAlchemy session (superuser), so RLS policies are bypassed. If you remove a `user_id` filter, you have broken access control.
3. **The authenticated `user_id` comes only from the verified JWT.** `get_current_user` (`ai_service/auth/`) verifies the Supabase access token (ES256/RS256 via JWKS) and returns `CurrentUser`. Routers receive `current_user: CurrentUser = Depends(get_current_user)` and use `current_user.id`. **Never** accept a `user_id` from a request body, path, or query — adding one is a regression. The `auth/` module never touches the database or application tables; it only verifies tokens and returns the identity.
3. **The system prompt is generated fresh from code** (`SYSTEM_PROMPT` in `ai_service/services/agent_service.py`). Never load or store a system prompt row in the database — a prompt fix must apply to every conversation immediately.
4. **Tool rows pair with their assistant row.** A `role='tool'` message must immediately follow the `role='assistant'` row whose `tool_calls` declared its `tool_call_id`. `db_messages_to_langchain` asserts this on every load.
5. **Exactly-once sends.** Same `idempotency_key` in the same conversation → the prior result is replayed, never reprocessed. Enforced by the partial unique index + savepoint catch, not check-then-insert.
6. **Conventions:** async SQLAlchemy everywhere; Python type hints; `from __future__ import annotations`; `logger = logging.getLogger(__name__)`; **do not add code comments unless asked**; use existing patterns from neighboring files.
7. **Development-only routes** (`ai_service/routers/dev.py`) are registered **only** when `ENVIRONMENT=development` (see `main.py`); in staging/production they return 404, not 401. The `ENVIRONMENT` flag never branches business logic, auth, DB queries, or AI behavior — it controls dev utilities only.

---

# Chat Request Lifecycle

`POST /api/v1/chat` → `ChatService.send_message` (`ai_service/services/chat_service.py`):

1. **Authenticate** — `get_current_user` verifies the Supabase JWT and yields `current_user.id`. This is the `user_id` used below; it is never read from the request.
2. **Idempotency check** — if `idempotency_key` is provided and a prior send exists, return the replayed result (no agent call, no new rows). Otherwise a fresh key is generated.
3. **Resolve conversation** — no `conversation_id` → create one for `user_id`. Existing → `ConversationRepository.get(id, user_id)`; `None` → 404.
4. **Persist user message** (`status='completed'`, with the idempotency key).
5. **Load recent context** — `get_recent_messages(conversation_id, user_id, limit)` where `limit = settings.MAX_CONVERSATION_HISTORY` (default 20). Converted to LangChain messages; the system prompt is prepended by the agent internally.
6. **Invoke agent** with `[system] + recent messages`.
7. **Persist the turn atomically** — intermediate assistant(`tool_calls`) rows → their tool rows → final assistant text row, in order, all in one commit (`save_assistant_turn`).
8. On agent failure, persist a single `status='failed'` assistant row with error details in `metadata` and return the apology message (200, retryable with a fresh key).
9. **Touch the conversation** — `message_count += N`, `last_message_at = now()`.

See `docs/ARCHITECTURE.md` for the full data-flow detail.

---

# Documentation Index

Read the relevant doc before changing that area. `AGENTS.md` is the entry point; the docs below carry the deep detail.

| When you are… | Read |
|---|---|
| Changing the agent, message conversion, or chat flow | `docs/ARCHITECTURE.md` |
| Touching any table, column, index, or migration | `docs/DATABASE.md` |
| Changing any endpoint or request/response schema | `docs/API.md` |
| Wondering *why* a design choice was made | `docs/DESIGN_DECISIONS.md` |

---

# Development Commands

Uses `uv` for dependency management. The virtualenv is `.venv`.

```bash
# Run the API (hot reload)
uv run uvicorn ai_service.main:app --reload

# Install a dependency (keeps uv.lock + requirements.txt in sync)
uv add <package>

# Migrations
uv run alembic upgrade head      # apply all pending migrations
uv run alembic downgrade -1      # roll back one revision
uv run alembic current           # show the DB's current revision
uv run alembic heads             # show the latest revision
uv run alembic revision -m "description"   # scaffold a new revision

# Verify code compiles
uv run python -m compileall ai_service
```

Migrations target Supabase via `DATABASE_URL` (see `ai_service/db/session.py`). New migrations must be reversible and must backfill existing rows.

There is no automated test suite yet — add one before Phase 2 ships. Verification today is manual smoke tests (multi-turn chat, tool reload, idempotency replay).

---

# Tools

Phase 1 tools are **database-backed** and follow the same layered flow as the chat pipeline: `tool → service → repository → SQLAlchemy`. Each tool reads the authenticated `user_id` and DB session from the request context (`ai_service/core/context.py`, set by `ChatService.send_message`) and delegates to a service. Tools return **structured JSON only** — never advice, recommendations, or SQL. All tools are registered in `ai_service/tools/__init__.py` — add new tools to the `all_tools` list there.

Available: `get_dashboard`, `get_recent_transactions`, `add_transaction`, `get_budget_status`, `get_financial_goals`, `get_user_profile`, `calculator`.

---

# Roadmap

- **Phase 1 — AI Chat Foundation (DONE):** FastAPI service, agent, chat endpoint, conversation management, message persistence, short-term memory, tool calling, hardened schema, idempotency, access control.
- **Phase 2 — Persistent Memory:** user facts, financial memory, memory extraction, memory manager. Stored as structured data, not conversation history.
- **Phase 3 — Financial Intelligence:** spending summaries, budget analysis, goal tracking, cash flow, insights — via tools, never assumptions.
- **Phase 4 — Advanced Intelligence:** conversation summaries, behavioral learning, spending prediction, personalized coaching, semantic memory, forecasting.

## Out of scope (do not touch until its phase)

Vector search / embeddings / RAG · conversation summarization · user facts / financial profile extraction · any "memory manager" abstraction. Also **not** in scope: having the AI execute SQL, access the database, or implement business logic.

---

# Definition of Done (for Phase 1 feature work)

1. A multi-turn conversation, including a mock-tool turn, survives a full backend restart — a new message after restart reflects earlier context.
2. Reloading a conversation that used a tool does not throw a `tool_call_id`-pairing error from the model API.
3. Sending the same request twice with the same `idempotency_key` does not create a duplicate message.
4. All schema changes exist via reversible Alembic migrations, with existing rows backfilled.
