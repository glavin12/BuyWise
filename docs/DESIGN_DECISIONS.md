# Design Decisions

## 1. Repository ownership is the application security boundary

Every owner-scoped query receives the authenticated user ID and applies it in SQL. Supabase RLS remains defense in depth, but the service connection is not an end-user RLS session.

## 2. Integer minor units

All persisted and service-layer money uses `BIGINT` minor units. Decimal conversion happens at the boundary with `Decimal` and round-half-up. This prevents binary float drift in balances, budgets, comparisons, and goals.

## 3. User-owned categories

Categories belong to a user and are seeded when the profile is created. This permits safe customization and prevents a category ID from crossing user boundaries. The previous shared `is_system` model and seed rows are removed.

## 4. One balance and a payment method, not accounts

Transactions belong directly to the user; there are no accounts. The balance is derived from the ledger, not stored (`starting_balance + income - expense`), and it is one number per user. Each transaction can carry an optional `payment_method` (`cash`, `upi`, `bank_transfer`, `card`, `other`), so spending can still be reported by how it was paid (`GET /api/v1/analytics/payment-methods`). This replaced the earlier multi-account model on 2026-09-10 (commit `76ea069`); the intent was one balance instead of several accounts, while keeping payment-method reporting.

## 5. No transfers

Two-sided transfer rows (`transfer_group_id`, `transfer_direction`) were removed together with accounts. `transaction_type` is `expense`, `income`, or `starting_balance`.

## 6. Starting balances are transactions

Opening balances use `transaction_type='starting_balance'` so the balance remains ledger-derived. Starting balances are explicitly excluded from income and expense analytics.

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

Only the final assistant text and the kinds of data changed by its tools are persisted in one commit; tool requests and results are transient. A partial unique index on `(user_id, idempotency_key)` for live rows with a key prevents duplicate chat turns under concurrent retry. The key is scoped per user so one user's key can never collide with another's. A retry that arrives while the first send is still running is refused with HTTP 409 rather than run the agent (and its write tools) a second time; a send whose turn failed can be retried with the same key.

## 14. The balance is one continuous number; budgets roll over

Decision 7 stored a budget per category and month, and at first each month stood alone: on the 1st an overspent category went back to zero and unspent money vanished, while "ready to assign" was the month's income minus what was assigned, which ignored the balance and anything left from before. That contradicted the single balance of decision 4. Now the balance is the same sum at every point in time, and a month is only a slice of it (opening and closing balance). Budgets work as envelopes: a category's available money is everything assigned to it in earlier months minus what was spent since it was first budgeted, plus this month's assigned and minus this month's spending, so leftovers and overspending both carry over. "Unassigned" is the closing balance minus the money in every envelope, which keeps `closing balance = money in envelopes + unassigned` true for every user and month.

Nothing is stored for this. Carry-over is worked out from `budget_entries` and the ledger on each request (two grouped queries), so editing an old transaction or budget corrects every later month, and there is no carry-over column that could drift. Overspending carries as a visible negative rather than being zeroed and quietly taken from the unassigned money, which hides the problem from new users. Spending from before a category's first budget is not counted against it, since it was never part of an envelope. `remaining` and `percent_used` stay this month's alone so progress bars still show this month's pace. There is no per-category switch to turn rollover off; add one only if users ask.
