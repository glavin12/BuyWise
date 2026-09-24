# API Reference

The FastAPI application is defined in `ai_service/main.py`. Interactive documentation is available at `http://localhost:8000/docs` only when `ENVIRONMENT=development`; `/docs`, `/redoc`, and `/openapi.json` return 404 otherwise (the default is `production`).

## Authentication

All routes except `/health` and `/health/live` require:

```text
Authorization: Bearer <supabase_access_token>
```

The backend validates the token against Supabase JWKS, issuer, audience, and expiry. The verified `sub` claim becomes `CurrentUser.id`. No endpoint accepts `user_id` in a body, path, or query parameter.

Errors use FastAPI's `{"detail": "..."}` shape. Authentication errors are HTTP 401 with `WWW-Authenticate: Bearer`.

| status | meaning |
|---|---|
| 400 | a business rule failed (unknown category, category/payee type differs from the transaction type, ...) |
| 409 | a database constraint conflict, for example renaming a payee or category to a name that exists: `{"detail": "This conflicts with an existing record."}`; on `POST /api/v1/chat`, `{"detail": "Still processing this message"}` |
| 422 | the body or query failed validation (see the limits below) |
| 429 | rate limit exceeded |

## Input Limits

| field | rule |
|---|---|
| transaction `description` / `notes` | at most 500 / 2000 characters |
| goal `description` | at most 1000 characters |
| goal `priority` | `low`, `medium`, or `high` |
| goal `goal_type` | `emergency_fund`, `purchase`, `vacation`, `investment`, `debt_repayment`, `education`, `retirement`, or `custom` |
| profile `currency` | three uppercase letters (ISO 4217), e.g. `INR` |
| profile `timezone` | an IANA name known to the server, e.g. `Asia/Kolkata` |
| category `color` | `#RRGGBB` |
| category `icon` | at most 32 characters (a keyword such as `public-transit`, or an emoji) |
| chat `message` / `idempotency_key` | at most 4000 / 128 characters |

A category's `type` is fixed at creation: `PATCH /api/v1/categories/{id}` ignores it.

## Money Contract

API write requests use integer minor units. For INR, `1050` means `INR 10.50`. Responses include the integer field and a `display_*` float for presentation. The API does not use floats as the persisted or service calculation representation.

## Profile Initialization

`GET /api/v1/profile` returns the authenticated profile and creates a default one on first read. `POST /api/v1/profile` creates or partially updates it (422 when the body has no fields). Profile creation seeds 36 user-owned categories (29 expense, 7 income) and 36 payees (20 expense, 16 income). There are no accounts.

## Balance And Payment Methods

There are no accounts or transfers. Each user has one running balance, `income + starting balances - expenses`, returned as `current_balance` by `GET /api/v1/dashboard`. A transaction can carry an optional `payment_method`: `cash`, `upi`, `bank_transfer`, `card`, or `other`. Spending by payment method is available from `GET /api/v1/analytics/payment-methods`.

## Categories And Payees

| method | path | behavior |
|---|---|---|
| POST/GET | `/api/v1/categories` | create or list owned categories; `type=expense|income` filters |
| GET/PATCH/DELETE | `/api/v1/categories/{category_id}` | get, update, or deactivate one category |
| POST/GET | `/api/v1/payees` | create or list owned payees |
| GET/PATCH/DELETE | `/api/v1/payees/{payee_id}` | get, rename, or delete one payee |

Category deletion is a soft deactivation, and category lists hide deactivated rows. Payee deletion is hard delete and transaction `payee_id` becomes null. `POST /api/v1/categories` returns the existing category when an active one with the same name and type exists, and `POST /api/v1/payees` returns the existing payee for the same normalized name and type.

## Transactions

| method | path | behavior |
|---|---|---|
| POST | `/api/v1/transactions` | create expense, income, or starting balance |
| GET | `/api/v1/transactions` | list with filters and pagination |
| GET | `/api/v1/transactions/{transaction_id}` | get one owned transaction |
| PATCH | `/api/v1/transactions/{transaction_id}` | update owned transaction fields |
| DELETE | `/api/v1/transactions/{transaction_id}` | hard delete owned transaction |

`currency` defaults to the profile currency. Expenses and income require a category of the matching type (a `starting_balance` does not), `payment_method` is optional, and `payee_name` finds or creates a payee. Changing `transaction_type`, `category_id`, or `payee_id` on `PATCH` must leave the category (and payee) type equal to the transaction type, otherwise the API returns 400. Lists are ordered by date, then creation time, then id, so offset pages never duplicate or skip rows.

GET filters are `category_id`, `payee_id`, `transaction_type`, `cleared_status`, `date_from`, `date_to`, `period`, `limit` (1 to 100, default 20), and `offset`. `transaction_type` accepts `expense`, `income`, and `starting_balance`; `period` accepts `this_month` and `last_month`.

Example create request:

```json
{
  "category_id": "00000000-0000-0000-0000-000000000002",
  "payee_name": "Local Cafe",
  "amount": 1250,
  "transaction_type": "expense",
  "payment_method": "upi",
  "transaction_date": "2026-08-11",
  "cleared_status": "cleared"
}
```

## Budgets

| method | path | behavior |
|---|---|---|
| POST | `/api/v1/budgets` | upsert one expense-category budget for month/year |
| GET | `/api/v1/budgets/{YYYY-MM}` | list budgets with spent, remaining, and percent used |
| GET | `/api/v1/budgets/id/{budget_id}` | get one budget |
| PATCH | `/api/v1/budgets/{budget_id}` | update budget amount |
| DELETE | `/api/v1/budgets/{budget_id}` | delete budget |

`GET /api/v1/dashboard` includes overall budget totals for `this_month` or `last_month`.

## Analytics

| method | path | query |
|---|---|---|
| GET | `/api/v1/analytics/monthly` | `month`, `year` |
| GET | `/api/v1/analytics/categories` | `month`, `year` |
| GET | `/api/v1/analytics/payment-methods` | `month`, `year` |
| GET | `/api/v1/analytics/comparison` | `month1`, `year1`, `month2`, `year2` |

Analytics returns integer minor units. Expense and income totals exclude starting balances and split child rows. `month` is 1 to 12 and `year` is 2020 to 2100. `payment-methods` groups the month's expenses by `payment_method` (null for untagged rows) and includes each method's `percent_of_total`. Month comparison includes signed amount and percentage changes; percentage is null when the previous value is zero.

## Goals And Dashboard

- `GET /api/v1/goals?status=active|completed|archived`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/{goal_id}`
- `GET /api/v1/dashboard?period=this_month|last_month`

Goals support optional category linkage and manual progress. Reaching `target_amount` marks the goal completed, and dropping below it reactivates it. An explicit `status` is respected (so a completed goal can be archived), and an archived goal is never changed by progress updates.

## Chat And Development Token

`POST /api/v1/chat` sends a message. With an `idempotency_key` the send is exactly-once per user: a completed send is replayed, a retry that arrives while the first is still running gets `409 Still processing this message` (the agent and its write tools run once), and a send that failed can be retried with the same key. Without an `idempotency_key` the server generates one, so every send is new. "Still running" is inferred from an unanswered user message, so a turn whose process died leaves its key answering 409; clients should send a fresh key per send. One agent turn is limited to 60 seconds. Its AI tools use the same category, transaction, budget, analytics, and goal services as the HTTP API.

`POST /api/v1/dev/token` is available only under `ENVIRONMENT=development`; it relays a password grant to Supabase Auth and is not registered in other environments.

## Rate Limits

Protected financial endpoints use the configured financial limit, default `60/minute`. Chat defaults to `20/minute`, conversations to `60/minute`, profile to `30/minute`, health to `60/minute`, and the dev helper to `10/minute`. `/health/live` is intentionally not rate limited.
