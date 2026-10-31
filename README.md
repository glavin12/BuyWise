# BuyWise

AI-first personal finance assistant. The AI understands the user's financial situation, uses tools to retrieve real data, and provides accurate financial help — with persistent conversation memory.

**Status:** Manual expense tracker foundation shipped — single-balance ledger with a per-transaction payment method, user-owned categories/payees, integer money, budgets, analytics, goals, persistent AI chat, and user-scoped access control. Two clients use this API: the Expo app in `mobile/` and the Next.js app in `frontend/` (their status is in `AGENTS.md`).

---

## Running the Backend Dev Server

> **Important:** Always run backend commands from the **repository root directory** (`Buywise/`), **not** from inside the `ai_service/` folder.
>
> If you run `uvicorn ai_service.main:app` while inside `ai_service/`, Python will raise:
> ```text
> ModuleNotFoundError: No module named 'ai_service'
> ```

### From Repository Root (Recommended):
```bash
uv run uvicorn ai_service.main:app --reload --host 0.0.0.0
```

### If you are currently inside `ai_service/`:
Step back to root or pass `--app-dir ..`:
```bash
# Option 1: Go back to root
cd ..
uv run uvicorn ai_service.main:app --reload --host 0.0.0.0

# Option 2: Run directly from inside ai_service/
uv run uvicorn ai_service.main:app --reload --app-dir .. --host 0.0.0.0
```

The API listens on all interfaces at port 8000, so it is reachable from a phone on the same Wi-Fi at the computer's LAN IP (for example, `http://10.0.0.5:8000`). Interactive API documentation is available at **http://127.0.0.1:8000/docs** (enabled when `ENVIRONMENT=development` in your `.env`).

---

## Quick Start (First-time Setup)

All commands must be executed from the **repository root**:

```bash
# 1. Install dependencies
uv sync --dev

# 2. Configure environment
cp .env.example .env
# Fill in BEDROCK_API_KEY and DATABASE_URL (Supabase Postgres)

# 3. Apply database migrations
uv run alembic upgrade head

# 4. Start the dev server
uv run uvicorn ai_service.main:app --reload --host 0.0.0.0
```

---

## Stack

- **FastAPI** + **LangChain** (`create_react_agent` via Amazon Bedrock)
- **PostgreSQL** (Supabase) with async **SQLAlchemy 2.0**
- **Alembic** migrations · **Pydantic v2** schemas
- Dependency management via **uv** (`.venv`)

---

## Project Layout

```text
Buywise/
├── ai_service/          FastAPI backend application
│   ├── main.py          FastAPI app + lifespan
│   ├── core/            Settings & rate limiting
│   ├── db/              Async engine & session
│   ├── models/          SQLAlchemy ORM models
│   ├── schemas/         Pydantic request/response models
│   ├── routers/         HTTP endpoints for chat & financial CRUD
│   ├── services/        Financial business rules & agent logic
│   ├── repositories/    Database access (all user_id-scoped)
│   ├── tools/           Financial tools exposed to the AI agent
│   └── utils/           Message formatting & financial helpers
├── alembic/             Database migrations
├── docs/                Architecture, database, API, and design decisions
├── mobile/              Expo / React Native mobile app
└── frontend/            Next.js web app
```

---

## Migrations

Run from repository root:

```bash
uv run alembic upgrade head     # Apply all pending migrations
uv run alembic downgrade -1     # Roll back one migration
uv run alembic current          # View current DB revision
```

---

## Testing

Run from repository root:

```bash
uv run pytest tests/ -v
uv run python -m compileall ai_service alembic
```

---

## Documentation

- `AGENTS.md` & `CLAUDE.md` — The operating manual and architecture specifications for agents & devs
- `docs/ARCHITECTURE.md` — Layers, chat lifecycle, repository contracts
- `docs/DATABASE.md` — Schema, indexes, enums, migrations
- `docs/API.md` — Endpoint + schema reference, idempotency semantics
- `docs/DESIGN_DECISIONS.md` — Rationale for core technical decisions
