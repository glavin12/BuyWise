# Database Schema

The PostgreSQL/Supabase schema is defined by the clean Alembic baseline in `alembic/versions/001_baseline.py`. The rebuild intentionally replaces the previous seven-migration chain and does not preserve old application rows.

## Common Conventions

- Financial primary keys use PostgreSQL `gen_random_uuid()` with an application-side UUID default in ORM tests and non-Postgres environments.
- Conversation and message IDs are UUIDv7 generated in Python, with a database fallback.
- Owner IDs are UUIDs derived from the verified Supabase JWT subject.
- Financial amounts are `BIGINT` minor units. Amount sign is represented by transaction type.
- Timestamp columns use `timestamptz`; transaction dates use calendar `DATE` without timezone.
- All user-owned tables have an index on `user_id` or an equivalent composite index.

## Tables

### `profiles`

One row per Supabase user. `id` references `auth.users.id` and is the application owner ID. Existing profile fields are preserved: `full_name`, `currency`, `income_type`, `salary_day`, `timezone`, `onboarding_complete`, `savings_target_percent`, `investment_style`, and `budget_alerts`, with the existing validation checks.

### `conversations`

Stores authenticated chat conversations with `user_id`, optional title, message counters, timestamps, and `deleted_at`. Indexes cover `user_id` and `(user_id, deleted_at)`. Conversations are soft-deleted.

### `messages`

Stores conversation messages with `conversation_id`, `user_id`, enum `role` (`user`, `assistant`, `system`, `tool`), content, JSONB tool calls, tool-call ID, enum `status`, idempotency key, metadata, token counts, timestamps, and soft-delete timestamp. A partial unique index `ix_messages_user_idempotency_key` on `(user_id, idempotency_key)`, limited to rows where the key is non-null and `deleted_at` is null, enforces exactly-once sends per user (a key is never shared across users). The conversation FK is `ON DELETE RESTRICT`.

### `categories`

Categories are user-owned. Columns are `id`, `user_id`, `name`, `type` (`expense` or `income`), optional `icon` and `color`, `is_active`, and timestamps. `(user_id, name, type)` is unique. Profile creation seeds 36 defaults per user (29 expense, 7 income; `DEFAULT_CATEGORIES`); there are no global `is_system` categories.

### `payees`

Columns are `id`, `user_id`, `name`, `normalized_name`, `type` (`expense` or `income`), and timestamps. `(user_id, normalized_name, type)` is unique; violating it (for example renaming a payee to an existing name) is returned by the API as HTTP 409. `normalized_name` is lowercase trimmed text used by `find_or_create()`. Profile creation seeds 36 predefined payees (20 expense, 16 income; `PREDEFINED_PAYEES`), and migration `002` backfills existing profiles additively.

### `transactions`

The ledger source of truth:

| column | type | rules |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK `profiles.id` `CASCADE` |
| `category_id` | uuid | nullable FK `categories.id` `RESTRICT` |
| `payee_id` | uuid | nullable FK `payees.id` `SET NULL` |
| `amount` | bigint | non-negative minor units |
| `currency` | text | default `INR` |
| `transaction_type` | text | `expense`, `income`, `starting_balance` |
| `payment_method` | text | nullable; `cash`, `upi`, `bank_transfer`, `card`, or `other` |
| `transaction_date` | date | default current date |
| `description`, `notes` | text | nullable |
| `cleared_status` | text | `pending` or `cleared` |
| `parent_transaction_id` | uuid | nullable self-FK `CASCADE` for future splits |
| timestamps | timestamptz | required |

Every row except a `starting_balance` requires a category (`transactions_category_required_check`), and `payment_method` is limited to the five values above (`transactions_payment_method_check`). Split child rows (`parent_transaction_id` set) are excluded from the balance and from analytical aggregates; split creation is not exposed yet.

Indexes cover `user_id`, `category_id`, `payee_id`, `transaction_date`, `(user_id, transaction_date)`, `(user_id, transaction_type)`, and `parent_transaction_id`.

The balance is one number per user, with no accounts table:

```text
starting_balance + income - expense
```

### `budget_entries`

Per-category monthly budgets. Columns are `id`, `user_id`, `category_id`, `month`, `year`, `budgeted_amount` in minor units, and timestamps. `(user_id, category_id, month, year)` is unique. Month is 1-12, year is 2020-2100, and amount is non-negative. The service only accepts active user-owned expense categories.

### `goals`

Columns are `id`, `user_id`, nullable `category_id`, title, description, `target_amount`, `current_amount`, goal type, priority, target date, status, and timestamps. Amounts are minor units. Category deletion sets the goal category to null. Status is `active`, `completed`, or `archived`; reaching the target marks a goal completed.

## Ownership And RLS

RLS is enabled on every public application table. Policies use `TO authenticated` and `(select auth.uid()) = user_id` (or `id` for profiles). Update policies include both `USING` and `WITH CHECK`; child tables use their denormalized `user_id`.

RLS is defense in depth, not the service security boundary. Every repository query still filters by the authenticated owner.

The Supabase Data API (`/rest/v1/...`) is not a supported access path: the Supabase URL and anon key ship inside the web and mobile bundles, and both clients use Supabase for authentication only. Migration `003` therefore runs `REVOKE ALL ... FROM anon, authenticated` on every application table, so a signed-in user cannot write tables directly and skip backend validation (for example by pointing a transaction at another user's category). The backend connects as the table owner, which the revoke does not affect. New tables must not be granted to those roles. Verify with:

```sql
select has_table_privilege('authenticated', 'public.transactions', 'INSERT');  -- must be false, for every app table
```

## Migrations

| revision | description |
|---|---|
| `001` | complete fresh schema, indexes, checks, enums, and RLS |
| `002` | `payees.type`, plus backfill of default categories and payees |
| `003` | revoke `anon`/`authenticated` table privileges; per-user messages idempotency index |

```bash
uv run alembic heads
uv run alembic upgrade head
uv run alembic downgrade base
uv run alembic upgrade head
```

Only run the downgrade/upgrade round trip against a disposable database. The baseline is a clean rebuild and is not a data-preserving migration for the previous schema.
