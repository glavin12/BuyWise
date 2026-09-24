# BuyWise Backend

This file describes the current backend and is the operating reference for coding agents.

## Purpose

BuyWise is an AI-first personal finance service with a manual expense tracker foundation. The backend provides:

- Supabase JWT-authenticated chat with persistent conversations.
- User-owned accounts, categories, payees, transactions, budgets, and goals.
- Integer minor-unit ledger arithmetic and account balance calculation.
- HTTP APIs for manual financial CRUD, transfers, analytics, dashboard data, profiles, goals, and conversations.
- LangChain tools that read and write the same financial services as the HTTP API.

## Stack

- Python 3.11 or newer.
- FastAPI, Uvicorn, Pydantic v2, and `pydantic-settings`.
- Async SQLAlchemy 2.0 with `asyncpg` and Alembic.
- PostgreSQL hosted by Supabase.
- Supabase JWKS JWT verification using PyJWT.
- LangChain, LangGraph, `langchain-groq`, and `create_react_agent`.
- `slowapi` for process-local rate limiting.
- `uv` for dependency management.
- pytest, pytest-asyncio, httpx, and aiosqlite for automated tests.

## Layout And Flow

```text
ai_service/
├── main.py                 FastAPI app, middleware, lifespan, router registration
├── auth/                   Supabase JWT verification and CurrentUser dependency
├── core/                   Settings, request context, and rate limiting
├── context/                Profile and time context assembled before chat
├── db/                     Declarative base and async sessions
├── models/                 SQLAlchemy ORM models
├── schemas/                Pydantic API schemas
├── routers/                HTTP endpoint handlers
├── services/               Business logic and orchestration
├── repositories/           SQLAlchemy queries and ownership filtering
├── tools/                  LangChain tools available to the agent
└── utils/                  Message conversion and financial helpers
alembic/versions/           Clean baseline and post-baseline data migrations
docs/                       Architecture, API, database, context, and decisions
```

Normal application flow is:

```text
Routes or tools -> Services -> Repositories -> SQLAlchemy -> PostgreSQL
```

Routes and tools do not execute SQL. Repositories own database queries. AI tools receive the authenticated owner and active session through `request_context()` context variables, not LLM-visible arguments.

## Authentication And Ownership

- Protected routes require `Authorization: Bearer <supabase_access_token>`.
- `ai_service/auth/` validates signature, issuer, audience, expiry, and required claims against Supabase JWKS.
- The verified JWT `sub` becomes `CurrentUser.id`; request bodies, paths, and query strings never supply `user_id`.
- Every owner-scoped repository method filters by the authenticated `user_id`.
- `profiles.id` is the authenticated user ID. Accounts, categories, payees, transactions, budget entries, and goals use `user_id`.
- Category, account, and payee references are ownership-validated in services before writes.
- RLS is enabled for defense in depth. The application still relies on repository ownership filters because its SQLAlchemy connection is not an end-user RLS session.

Authentication failures return HTTP 401 with `WWW-Authenticate: Bearer`.

## Money And Ledger Rules

- Persisted amounts are non-negative `BIGINT` minor units. INR `10.50` is stored as `1050`.
- `amount_to_minor()` uses decimal rounding, not binary float arithmetic.
- API financial responses expose integer fields plus `display_*` values for presentation.
- AI tools accept normal display amounts and convert them before calling services.
- Expense and income analytics exclude `transfer`, `starting_balance`, and split child rows.
- Account balances add income and starting balances, subtract expenses, and apply transfer direction (`in` or `out`).
- A transfer is two atomic `transaction_type='transfer'` rows with one `transfer_group_id`; `transfer_direction` distinguishes the sides.
- Non-transfer expenses and income require a category. Starting balances and transfers do not.
- Transaction dates are calendar `DATE` values. Period helpers return `[start, end)` date ranges and support `this_month` and `last_month`.

## Profile Initialization

Creating a profile seeds 20 user-owned default categories and creates one active `Cash` account using the profile currency. Category defaults are not global system rows.

## HTTP API

All routes are registered in `ai_service/main.py` and use the `/api/v1/` prefix.

Public routes:

- `GET /health`
- `GET /health/live`

Protected chat and account routes:

- `POST /api/v1/chat`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations`
- `GET /api/v1/conversations/{conversation_id}/messages`
- `DELETE /api/v1/conversations/{conversation_id}`
- `GET /api/v1/profile`
- `POST /api/v1/profile`
- `GET /api/v1/dashboard`
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/{goal_id}`
- `POST|GET /api/v1/accounts`
- `GET|PATCH|DELETE /api/v1/accounts/{account_id}`
- `POST|GET /api/v1/categories`
- `GET|PATCH|DELETE /api/v1/categories/{category_id}`
- `POST|GET /api/v1/payees`
- `GET|PATCH|DELETE /api/v1/payees/{payee_id}`
- `POST|GET /api/v1/transactions`
- `GET|PATCH|DELETE /api/v1/transactions/{transaction_id}`
- `POST /api/v1/transfers`
- `DELETE /api/v1/transfers/{transfer_group_id}`
- `POST /api/v1/budgets`
- `GET /api/v1/budgets/{YYYY-MM}`
- `GET /api/v1/budgets/id/{budget_id}`
- `PATCH|DELETE /api/v1/budgets/{budget_id}`
- `GET /api/v1/analytics/monthly`
- `GET /api/v1/analytics/categories`
- `GET /api/v1/analytics/comparison`

The development-only `POST /api/v1/dev/token` helper and the interactive API docs (`/docs`, `/redoc`, `/openapi.json`) exist only when `ENVIRONMENT=development`. `ENVIRONMENT` defaults to `production`, so a deploy that forgets it fails closed; set `ENVIRONMENT=development` in your local `.env`.

Constraint conflicts (`IntegrityError`, e.g. renaming a payee to an existing name) are returned as HTTP 409 with a generic body by a global handler in `main.py`.

## Chat And AI Tools

`ChatService` persists the user message, builds lightweight profile/time context, reloads capped history, invokes the ReAct agent, and persists tool calls, tool results, and the final assistant message atomically. Idempotency is enforced by the messages unique index on `(user_id, idempotency_key)` (live rows only): a completed send is replayed, a send whose agent turn is still running returns HTTP 409, and a failed send can be retried with the same key. One agent turn is capped at 60 s and 12 graph steps, chat messages at 4000 characters, and the LLM client at 45 s / 4096 tokens.

Registered financial tools are:

- `get_dashboard`
- `get_accounts`
- `get_profile`
- `get_recent_transactions`
- `add_transaction`
- `get_spending_breakdown`
- `get_income_summary`
- `get_budget_status`
- `set_category_budget`
- `get_financial_goals`
- `add_goal`
- `update_goal_progress`
- `get_categories`
- `calculator`

`calculator` parses expressions with `ast` (numbers, `+ - * / // % **` and parentheses only; values within ±1e15, exponents within ±100, 200 characters). It never calls `eval`.

The system prompt is `SYSTEM_PROMPT` in `ai_service/services/agent_service.py`. It must describe the current tool names and ledger semantics.

## Database And Migrations

The repository now contains a clean rebuild:

- `001_baseline.py` drops no existing data itself but creates the complete application schema on a fresh database.
- `002_payee_types_and_predefined_data.py` adds `payees.type` and backfills default categories and payees.
- `003_security_hardening.py` revokes the `anon` and `authenticated` roles' table privileges (the Supabase Data API is not a supported access path; the backend connects as the table owner) and makes the messages idempotency index per user.
- The old seven migrations are deleted from the repository history.

The baseline creates `profiles`, `conversations`, `messages`, `accounts`, `categories`, `payees`, `transactions`, `budget_entries`, and `goals`, plus indexes, constraints, enums, and RLS policies. It is intentionally destructive when used as a reset strategy. Do not apply it to a database containing data that must be preserved.

The current Alembic head is `003`.

## Development Commands

```bash
uv sync --dev
uv run alembic heads
uv run alembic upgrade head
uv run uvicorn ai_service.main:app --reload
uv run python -m compileall ai_service alembic
uv run pytest tests/ -v
```

Use `DATABASE_URL` or `SUPABASE_DATABASE_URL`; PostgreSQL URLs are normalized to `postgresql+asyncpg://`. The interactive API docs are at `http://localhost:8000/docs` when `ENVIRONMENT=development`.

## Documentation

- `docs/ARCHITECTURE.md`: application layers, services, repositories, chat, and invariants.
- `docs/API.md`: authentication, endpoints, filters, and request/response contracts.
- `docs/DATABASE.md`: tables, constraints, ownership, indexes, RLS, and migrations.
- `docs/CONTEXT_MANAGER.md`: base context and loader contract.
- `docs/DESIGN_DECISIONS.md`: rationale for minor units, user-owned categories, transfers, and the rebuild.

When implementation and documentation disagree, verify code and migrations first, then update the relevant documentation in the same change.
