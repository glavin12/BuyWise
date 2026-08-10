# API Reference

The FastAPI application is defined in `ai_service/main.py`. Interactive documentation is available at `http://localhost:8000/docs`.

## Authentication

All routes except `/health` and `/health/live` require:

```text
Authorization: Bearer <supabase_access_token>
```

The backend validates the token against Supabase JWKS, issuer, audience, and expiry. The verified `sub` claim becomes `CurrentUser.id`. No endpoint accepts `user_id` in a body, path, or query parameter.

Errors use FastAPI's `{"detail": "..."}` shape. Authentication errors are HTTP 401 with `WWW-Authenticate: Bearer`.

## Money Contract

API write requests use integer minor units. For INR, `1050` means `INR 10.50`. Responses include the integer field and a `display_*` float for presentation. The API does not use floats as the persisted or service calculation representation.

## Profile Initialization

`GET /api/v1/profile` returns the authenticated profile. `POST /api/v1/profile` creates or partially updates it. The first profile creation also seeds 20 user-owned categories and an active `Cash` account.

## Accounts

| method | path | behavior |
|---|---|---|
| POST | `/api/v1/accounts` | create account; optional `starting_balance` creates a starting-balance ledger row |
| GET | `/api/v1/accounts` | list active accounts with ledger balances |
| GET | `/api/v1/accounts/{account_id}` | get one owned active account |
| PATCH | `/api/v1/accounts/{account_id}` | update name, type, or currency |
| DELETE | `/api/v1/accounts/{account_id}` | deactivate account |

Account balances include starting balances, income, expenses, and signed transfer sides.

## Categories And Payees

| method | path | behavior |
|---|---|---|
| POST/GET | `/api/v1/categories` | create or list owned categories; `type=expense|income` filters |
| GET/PATCH/DELETE | `/api/v1/categories/{category_id}` | get, update, or deactivate one category |
| POST/GET | `/api/v1/payees` | create or list owned payees |
| GET/PATCH/DELETE | `/api/v1/payees/{payee_id}` | get, rename, or delete one payee |

Category deletion is a soft deactivation. Payee deletion is hard delete and transaction `payee_id` becomes null.

## Transactions

| method | path | behavior |
|---|---|---|
| POST | `/api/v1/transactions` | create expense, income, or starting balance |
| GET | `/api/v1/transactions` | list with filters and pagination |
| GET | `/api/v1/transactions/{transaction_id}` | get one owned transaction |
| PATCH | `/api/v1/transactions/{transaction_id}` | update owned transaction fields |
| DELETE | `/api/v1/transactions/{transaction_id}` | hard delete owned transaction |

GET filters are `account_id`, `category_id`, `payee_id`, `transaction_type`, `cleared_status`, `date_from`, `date_to`, `period`, `limit`, and `offset`. `transaction_type` accepts `expense`, `income`, `transfer`, and `starting_balance`; `period` accepts `this_month` and `last_month`.

Example create request:

```json
{
  "account_id": "00000000-0000-0000-0000-000000000001",
  "category_id": "00000000-0000-0000-0000-000000000002",
  "payee_name": "Local Cafe",
  "amount": 1250,
  "transaction_type": "expense",
  "transaction_date": "2026-08-11",
  "cleared_status": "cleared"
}
```

## Transfers

`POST /api/v1/transfers` creates two linked transfer rows atomically. It requires `from_account_id`, `to_account_id`, positive minor-unit `amount`, optional date, and optional description. `DELETE /api/v1/transfers/{transfer_group_id}` removes both owned sides atomically. Transfers require matching account currencies and are excluded from income/expense totals.

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
| GET | `/api/v1/analytics/comparison` | `month1`, `year1`, `month2`, `year2` |

Analytics returns integer minor units. Expense and income totals exclude transfers, starting balances, and split child rows. Month comparison includes signed amount and percentage changes; percentage is null when the previous value is zero.

## Goals And Dashboard

- `GET /api/v1/goals?status=active|completed|archived`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/{goal_id}`
- `GET /api/v1/dashboard?period=this_month|last_month`

Goals support optional category linkage and manual progress. Reaching `target_amount` marks the goal completed.

## Chat And Development Token

`POST /api/v1/chat` retains the existing conversation and idempotency semantics. Its AI tools use the same account, category, transaction, budget, analytics, and goal services as the HTTP API.

`POST /api/v1/dev/token` is available only under `ENVIRONMENT=development`; it relays a password grant to Supabase Auth and is not registered in other environments.

## Rate Limits

Protected financial endpoints use the configured financial limit, default `60/minute`. Chat defaults to `20/minute`, conversations to `60/minute`, profile to `30/minute`, health to `60/minute`, and the dev helper to `10/minute`. `/health/live` is intentionally not rate limited.
