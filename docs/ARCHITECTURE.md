# Architecture

BuyWise is a layered FastAPI service. The financial tracker and AI assistant share the same service and repository contracts.

## Module Map

```text
ai_service/
├── main.py
├── auth/                 JWT verification and CurrentUser
├── core/                 settings, contextvars, rate limiting
├── context/              profile/time base context for chat
├── db/                   SQLAlchemy base and async sessions
├── models/               conversation and financial ORM models
├── schemas/              Pydantic API contracts
├── routers/              HTTP controllers
├── services/             business rules and orchestration
├── repositories/         user-scoped database access
├── tools/                structured LangChain tools
└── utils/                message and financial helpers
```

The dependency direction is:

```text
HTTP route or AI tool -> service -> repository -> SQLAlchemy -> PostgreSQL
```

Repositories never trust an owner ID from an LLM or request body. Services validate foreign references against the authenticated owner before writes.

## Financial Services

- `ProfileService`: profile CRUD and first-profile initialization (seeds default categories and payees).
- `AccountService`: account deletion. Deletes the user's data (`AccountRepository`) and then their Supabase Auth login through the Admin API with `SUPABASE_SERVICE_ROLE_KEY`; refuses, deleting nothing, when that key is not set.
- `CategoryService`: user-owned category CRUD and default seeding.
- `PayeeService`: normalized payee CRUD.
- `TransactionService`: ledger CRUD, ownership validation, filters, and serialization. A page of transactions is two statements: the rows with their categories and payees joined in, and the total (`tests/test_request_cost.py` holds it there).
- `BudgetService`: per-category monthly budget upsert and CRUD, and `month_view`, which works out a month's rollover (carried-in and available per category), the opening and closing balance and the unassigned money from the budget entries and the ledger, storing nothing. It reads the opening, closing and live balance in one statement and names the categories that carry money without a budget with one query, so its cost does not grow with them. The month's expense total is the sum of its per-category spending (every expense has a category), not another query.
- `AnalyticsService`: monthly summary, category spending, comparison, and AI-facing breakdowns.
- `GoalService`: category-linked goals and manual progress completion.
- `DashboardService`: composition of profile, the budget view (which carries the opening, closing and live balance and the month's spending), the month's income, and goals, in at most 8 SQL statements (`tests/test_request_cost.py` holds it there). Takes the caller's `today` so "this month" follows the user's calendar, not the server's UTC clock.

## Ledger Invariants

- All amounts are non-negative integer minor units.
- Expenses and income require an owned category of the matching type; starting balances do not.
- There are no accounts and no transfers. Each user has one balance: `starting_balance + income - expense`.
- Starting balances are ledger rows but are never counted as income or expenses.
- The balance is never stored and never resets: a month's opening and closing balance are the same sum taken up to the month's start and end (`TransactionRepository.get_balance(before=...)`; `get_balances` takes several dates, and `None` for now, in one statement).
- Budgets roll over: `available = carried_in + assigned - spent` per category and `unassigned = closing balance - sum(available)`, so the closing balance always equals the money in envelopes plus the unassigned money.
- Each transaction has an optional `payment_method` (`cash`, `upi`, `bank_transfer`, `card`, `other`).
- Split child rows are excluded from the balance and from aggregate queries; parent/child persistence is extensible but split creation is not exposed yet.
- Every financial query includes `user_id` and, where applicable, owned category/payee references.

## Chat Lifecycle

`POST /api/v1/chat` is orchestrated by `ChatService.send_message`:

1. Verify the Supabase JWT and obtain `CurrentUser.id`.
2. If the idempotency key already exists for this user: replay a completed send, return HTTP 409 while its agent turn is still running, or retry a failed send on the same message and conversation.
3. Create or load an owner-scoped conversation.
4. Persist the user message and derive a title when needed.
5. Build lightweight profile and UTC-date context.
6. Load the capped recent message history and rebuild LangChain messages.
7. Run the ReAct agent inside `request_context(user_id, session, turn_id=<user message id>)`, bounded to 60 s and 12 graph steps. A callback on the model client (`_ReleaseDbConnection`) ends the session's transaction before every model call, so the turn holds a pooled connection only while a tool's queries run, not while the model thinks. A step's tool calls run concurrently in LangGraph, so each tool holds the turn's `tool_lock()` and the session is used by one tool at a time. `add_transaction` keys its write `chat:{user message id}:transaction:{n}`, so a retried failed send does not save the same expense twice.
8. Parse assistant tool calls, tool results, and final text.
9. Persist the complete assistant turn in order in one commit.
10. On provider failure or timeout, roll the session back (a tool may have left it mid-transaction), persist a failed assistant row, and return the existing apology response contract.

Tool calls are stored structurally in `messages.tool_calls`; tool rows reference `tool_call_id`. `db_messages_to_langchain()` validates pairing before an external model call.

## Base Context

`ContextManager` reads the profile once, hands it to every loader and injects a small `[CONTEXT]` system message containing profile details and the user's local date with their timezone (from `profile.timezone`; Asia/Kolkata when missing). `ChatService` passes that date into `request_context`, and the tools read it through `get_today()`. Transactions, budgets, analytics, and goals are not preloaded; the agent retrieves them through tools only when needed.

## AI Tools

Registered tools are `get_dashboard`, `get_profile`, `get_recent_transactions`, `add_transaction`, `get_spending_breakdown`, `get_income_summary`, `get_budget_status`, `set_category_budget`, `get_financial_goals`, `add_goal`, `update_goal_progress`, `get_categories`, and `calculator`.

AI-facing display amounts are converted to minor units before service calls. Tool return values remain structured; natural-language explanation belongs to the agent.

## Database Connections

`ai_service/db/session.py` builds one async engine per process. Its pool keeps 10 connections and opens up to 5 more for a burst; Home alone fires 5 requests at once. Each request is one session (`get_async_session`), so one checkout.

Unless `DB_POOL_PRE_PING=false`, every checkout pings the connection first with one `SELECT 1` limited to 3 s (a `checkout` listener in `_guard_pool`; SQLAlchemy's `pool_pre_ping` is off, because its ping is three round trips, each allowed the full `command_timeout`, and a ping that times out fails the request instead of reconnecting). A connection the pooler dropped, or one left half-dead, is replaced inside the same checkout.

The ping cannot catch a connection that went half-dead (opened on an earlier network, before a Wi-Fi change or sleep): it gets no error, only retransmits, so the ping hangs too. So every connection is replaced after 5 minutes (`pool_recycle=300`), and asyncpg's `command_timeout=10` fails a statement that waits longer, under the clients' 15 s request timeout; connecting and waiting for a free pooled connection are limited to 10 s too. `_guard_pool` handles what follows a timeout: asyncpg's polite close would wait forever for the server to answer the cancelled query, so the socket is closed at once, and every connection opened before the timeout is discarded together, so the rest of the pool does not fail one request at a time. A fault-injection test (`tests/test_db_resilience.py`, a TCP proxy that freezes open connections) shows a network break costing one 0.5 s request with the ping and one failed request without it; before, four requests hung. A timeout, a full pool or a dropped connection that reaches a route answers 503 with `Retry-After: 2`. On 2026-10-24 a server that had run for 8 hours took 2 to 3 s per `POST /budgets`, with one request hanging, while a fresh process took 0.45 s.

Responses of 1 KB or more are gzip-compressed for clients that send `Accept-Encoding: gzip` (`GZipMiddleware` in `main.py`).

## Testing Seams

Repositories and services accept an `AsyncSession`, so the test suite uses an in-memory SQLite async database. ORM financial IDs have Python UUID defaults for this environment; production migrations retain PostgreSQL UUID defaults. API tests override `get_current_user` and `get_async_session` and use `httpx.AsyncClient` through `ASGITransport`.

Run:

```bash
uv run pytest tests/ -v
uv run python -m compileall ai_service alembic
```
