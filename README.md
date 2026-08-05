# BuyWise AI Service

AI-first personal finance assistant. The AI understands the user's financial situation, uses tools to retrieve real data, and provides accurate financial help — with persistent conversation memory.

**Status:** Phase 1 (AI Chat Foundation) shipped — persistent conversation memory, tool calling, idempotency, and user-scoped access control.

## Stack

- **FastAPI** + **LangChain** (`create_react_agent` via Groq) 
- **PostgreSQL** (Supabase) with async **SQLAlchemy 2.0**
- **Alembic** migrations · **Pydantic v2** schemas
- Dependency management via **uv** (`.venv`)

## Quick start

```bash
# 1. Install dependencies
uv sync

# 2. Configure environment
cp .env.example .env
#    fill in GROQ_API_KEY and DATABASE_URL (Supabase Postgres)

# 3. Apply migrations
uv run alembic upgrade head

# 4. Run the API (hot reload)
uv run uvicorn ai_service.main:app --reload
```

Open http://localhost:8000/docs for the interactive API docs.

## Project layout

```
ai_service/
├── main.py          FastAPI app + lifespan
├── core/            settings (env-driven)
├── db/              async engine/session
├── models/          SQLAlchemy ORM (conversations, messages)
├── schemas/         Pydantic request/response models
├── routers/         HTTP endpoints (chat, conversations, health)
├── services/        chat flow, conversation lifecycle, agent
├── repositories/    all database access (user_id-scoped)
├── tools/           database-backed financial tools (AI-accessible)
└── utils/           DB rows → LangChain messages, month/period helpers
alembic/             reversible migrations
docs/                architecture, database, API, design decisions
```

## Documentation

- `AGENTS.md` — the operating manual (entry point for AI coding agents)
- `docs/ARCHITECTURE.md` — layers, chat lifecycle, repository contracts
- `docs/DATABASE.md` — schema, indexes, enums, migrations
- `docs/API.md` — endpoint + schema reference, idempotency semantics
- `docs/DESIGN_DECISIONS.md` — why key choices were made

## Core behavior

- **Persistent memory** — prior messages reload into the agent every request and survive restarts.
- **Tool calling** — assistant `tool_calls` + tool results persist and round-trip on reload. Tools read the authenticated user + DB session from request context and return structured JSON only.
- **Exactly-once sends** — the same `idempotency_key` replays the prior result, never duplicates.
- **Access control** — every repository read/write filters by `user_id` (RLS is not relied on).
- **Context cap** — the last `MAX_CONVERSATION_HISTORY` (20) messages feed the agent.

## Migrations

```bash
uv run alembic upgrade head     # apply all pending
uv run alembic downgrade -1     # roll back one
uv run alembic current          # current DB revision
```

## Testing

There is no automated test suite yet (target: add one before Phase 2). Verification today is manual smoke tests: multi-turn chat with a tool turn surviving a restart, tool reload with no pairing errors, and idempotency replay.
