# Design Decisions

## 1. Repository ownership is the application security boundary

Every owner-scoped query receives the authenticated user ID and applies it in SQL. Supabase RLS remains defense in depth, but the service connection is not an end-user RLS session.

## 2. Integer minor units

All persisted and service-layer money uses `BIGINT` minor units. Decimal conversion happens at the boundary with `Decimal` and round-half-up. This prevents binary float drift in balances, budgets, comparisons, and goals.

## 3. User-owned categories

Categories belong to a user and are seeded when the profile is created. This permits safe customization and prevents a category ID from crossing user boundaries. The previous shared `is_system` model and seed rows are removed.

## 4. Accounts are first-class ledger owners

Transactions attach to accounts rather than directly to a profile. Account balances are derived from the ledger, not stored. Profile creation creates a default Cash account so manual entry works immediately.

## 5. Explicit transfer direction

The two-sided transfer design requires `transfer_direction` in addition to `transfer_group_id`. Without an `in`/`out` marker, two positive transfer amounts cannot produce correct account balances. Transfer creation and deletion are atomic.

## 6. Starting balances are transactions

Opening balances use `transaction_type='starting_balance'` so account balances remain ledger-derived. Starting balances are explicitly excluded from income and expense analytics.

## 7. Category budgets replace monthly plans

`budget_entries` stores one amount per owned expense category and calendar month. Budget status joins those entries with actual expense rows. Expected income and savings-plan fields are no longer the budget model.

## 8. Transaction dates are calendar dates

Manual expense entries represent a user-selected day, not an instant. The database uses `DATE`; period helpers return date boundaries and avoid timezone shifts around month edges.

## 9. Split-ready transaction shape, deferred behavior

`parent_transaction_id` exists with a self-referencing cascade for future split support. Aggregate queries exclude child rows and currently operate on unsplit transactions. Split creation is intentionally not part of this foundation.

## 10. Clean database rebuild

The old seven migrations are replaced by `001_baseline.py`. The baseline is designed for a fresh database and intentionally does not migrate existing rows. It must not be applied to data that needs preservation.

## 11. AI and HTTP paths share services

AI tools do not contain parallel financial logic. They resolve context-only identity/session values, convert display amounts, and call the same services used by HTTP routes.

## 12. Hybrid chat context

The agent receives lightweight profile/time context plus just-in-time tools for expensive financial data. This limits token use while keeping currency and profile awareness available immediately.

## 13. Atomic conversation turns and idempotency

Assistant tool calls, tool results, and final text are persisted in order in one commit. A partial unique index on `(user_id, idempotency_key)` for live rows with a key prevents duplicate chat turns under concurrent retry. The key is scoped per user so one user's key can never collide with another's. A retry that arrives while the first send is still running is refused with HTTP 409 rather than run the agent (and its write tools) a second time; a send whose turn failed can be retried with the same key.
