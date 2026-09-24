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

- `ProfileService`: profile CRUD and first-profile initialization.
- `AccountService`: account CRUD, default Cash account, starting balance rows, and balances.
- `CategoryService`: user-owned category CRUD and default seeding.
- `PayeeService`: normalized payee CRUD.
- `TransactionService`: ledger CRUD, ownership validation, filters, and serialization.
- `TransferService`: atomic paired transfer creation/deletion.
- `BudgetService`: per-category monthly budget upsert, status, and CRUD.
- `AnalyticsService`: monthly summary, category spending, comparison, and AI-facing breakdowns.
- `GoalService`: category-linked goals and manual progress completion.
- `DashboardService`: composition of profile, accounts, analytics, budgets, and goals.

## Ledger Invariants

- All amounts are non-negative integer minor units.
- Expenses and income require an owned category of the matching type.
- A transfer creates exactly two rows with the same group ID and opposite directions.
- Starting balances are ledger rows but are never counted as income or expenses.
- Transfer rows are never counted as income or expenses.
- Account balance sign logic is `starting_balance + income - expense + transfer(in) - transfer(out)`.
- Split child rows are excluded from aggregate queries; parent/child persistence is extensible but split creation is not exposed yet.
- Every financial query includes `user_id` and, where applicable, owned account/category/payee references.

## Chat Lifecycle

`POST /api/v1/chat` is orchestrated by `ChatService.send_message`:

1. Verify the Supabase JWT and obtain `CurrentUser.id`.
2. If the idempotency key already exists for this user: replay a completed send, return HTTP 409 while its agent turn is still running, or retry a failed send on the same message and conversation.
3. Create or load an owner-scoped conversation.
4. Persist the user message and derive a title when needed.
5. Build lightweight profile and UTC-date context.
6. Load the capped recent message history and rebuild LangChain messages.
7. Run the ReAct agent inside `request_context(user_id, session)`, bounded to 60 s and 12 graph steps.
8. Parse assistant tool calls, tool results, and final text.
9. Persist the complete assistant turn in order in one commit.
10. On provider failure or timeout, roll the session back (a tool may have left it mid-transaction), persist a failed assistant row, and return the existing apology response contract.

Tool calls are stored structurally in `messages.tool_calls`; tool rows reference `tool_call_id`. `db_messages_to_langchain()` validates pairing before an external model call.

## Base Context

`ContextManager` injects a small `[CONTEXT]` system message containing profile details and the current UTC date. Transactions, budgets, analytics, and goals are not preloaded; the agent retrieves them through tools only when needed.

## AI Tools

Registered tools are `get_dashboard`, `get_accounts`, `get_profile`, `get_recent_transactions`, `add_transaction`, `get_spending_breakdown`, `get_income_summary`, `get_budget_status`, `set_category_budget`, `get_financial_goals`, `add_goal`, `update_goal_progress`, `get_categories`, and `calculator`.

AI-facing display amounts are converted to minor units before service calls. Tool return values remain structured; natural-language explanation belongs to the agent.

## Testing Seams

Repositories and services accept an `AsyncSession`, so the test suite uses an in-memory SQLite async database. ORM financial IDs have Python UUID defaults for this environment; production migrations retain PostgreSQL UUID defaults. API tests override `get_current_user` and `get_async_session` and use `httpx.AsyncClient` through `ASGITransport`.

Run:

```bash
uv run pytest tests/ -v
uv run python -m compileall ai_service alembic
```
