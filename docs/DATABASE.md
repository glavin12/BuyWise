# Database Schema

Reference for the PostgreSQL (Supabase) schema. Read this before touching any table, column, index, or migration.

---

## ID strategy

- Primary keys are `UUID` columns.
- Values are **UUIDv7 generated in the application layer** via `generate_uuid7()` (`ai_service/models/conversation.py`, backed by `uuid-utils`). Postgres 17.6 has no native `uuidv7()`, so the value is produced in Python and stored in a plain UUID column.
- The columns keep `server_default=gen_random_uuid()` as a harmless fallback for non-app inserts; the app's Python-side `default` takes precedence for our writes.

---

## `conversations`

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | (app uuid7) | PK |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id) ON DELETE CASCADE`; indexed |
| `title` | `varchar(255)` | YES | — | generated from first exchange in a later phase |
| `message_count` | `integer` | NO | `0` | denormalized, `+N` on every message save |
| `last_message_at` | `timestamptz` | YES | — | denormalized, set on every message save |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | bumped on touch |
| `deleted_at` | `timestamptz` | YES | — | soft delete |

Indexes: `ix_conversations_user_id`.

---

## `messages`

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | (app uuid7) | PK |
| `conversation_id` | `uuid` | NO | — | FK → `conversations(id) ON DELETE RESTRICT` |
| `user_id` | `uuid` | NO | — | denormalized owner copy; access checks need no join |
| `role` | enum `message_role` | NO | — | `user` / `assistant` / `system` / `tool` |
| `content` | `text` | NO | — | for `tool` rows: stringified tool output |
| `tool_call_id` | `text` | YES | — | required on `tool` rows; matches an `id` in the paired assistant row's `tool_calls` |
| `tool_calls` | `jsonb` | YES | — | assistant rows only: array of `{name, args, id}` mirroring LangChain `AIMessage.tool_calls` |
| `status` | enum `message_status` | NO | `'completed'` | `pending` / `completed` / `failed` |
| `idempotency_key` | `text` | YES | — | client key; partial-unique |
| `metadata` | `jsonb` | YES | — | extras: model/version, latency_ms, error details |
| `prompt_tokens` | `integer` | YES | — | assistant rows |
| `completion_tokens` | `integer` | YES | — | assistant rows |
| `total_tokens` | `integer` | YES | — | assistant rows |
| `created_at` | `timestamptz` | NO | `now()` | order with `(created_at, id)` — same-ms messages are possible |
| `deleted_at` | `timestamptz` | YES | — | soft delete |

> **`metadata` column, Python attribute:** `metadata` is a reserved name in SQLAlchemy's Declarative API, so the ORM attribute is `message_metadata` mapped to the DB column `metadata`.

### Indexes
| index | columns | uniqueness | notes |
|---|---|---|---|
| `ix_messages_conversation_created_at_id` | `(conversation_id, created_at, id)` | no | hit on every chat request; supports `ORDER BY created_at, id` |
| `ix_messages_user_id` | `(user_id)` | no | access checks |
| `ix_messages_idempotency_key` | `(idempotency_key)` | **unique partial** | `WHERE idempotency_key IS NOT NULL` — enforces exactly-once |
| `messages_pkey` | `(id)` | PK | |

### Foreign keys
- `conversation_id → conversations(id) ON DELETE RESTRICT` — conversations are soft-deleted only, so this never fires.

### Enums
- `message_role`: `user`, `assistant`, `system`, `tool`
- `message_status`: `pending`, `completed`, `failed`

---

## Financial tables

The core financial schema (`profiles`, `categories`, `transactions`, `monthly_plans`) was created by the Supabase migration `20260728184215` ("create_buywise_core_schema") **outside** the Alembic chain. Alembic migration `202608050001` enhanced them and added `goals`. Models live in `ai_service/models/financial.py`.

> **ID strategy note:** financial tables use DB-side `gen_random_uuid()` (v4) as their PK default — unlike `conversations`/`messages` which use app-layer UUIDv7. The repository layer relies on the DB default + flush/refresh to obtain the id.

### `profiles` — one row per user (`id` = `auth.users.id`)

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | — | PK, FK → `auth.users(id) ON DELETE CASCADE` |
| `full_name` | `text` | YES | — | |
| `currency` | `text` | NO | `'INR'` | |
| `income_type` | `text` | YES | — | `salaried` / `freelancer` / `business_owner` / `retired` / `other` |
| `salary_day` | `integer` | YES | — | day of month income lands; nullable (freelancers etc.), CHECK 1–31 |
| `timezone` | `text` | NO | `'Asia/Kolkata'` | |
| `onboarding_complete` | `boolean` | NO | `false` | |
| `savings_target_percent` | `integer` | YES | — | CHECK 0–100 |
| `investment_style` | `text` | YES | — | `conservative` / `moderate` / `aggressive` |
| `budget_alerts` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

### `categories` — shared lookup, hierarchical

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | CHECK non-empty; `UNIQUE(name, type)` |
| `type` | `text` | NO | — | `expense` / `income` |
| `icon` | `text` | YES | — | |
| `color` | `text` | YES | — | |
| `parent_category_id` | `uuid` | YES | — | self-FK → `categories(id) ON DELETE SET NULL`; 1 level of nesting for MVP |
| `is_system` | `boolean` | NO | `false` | built-in defaults vs user-created |
| `created_at` | `timestamptz` | NO | `now()` | |

### `transactions` — source of truth ledger

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `profile_id` | `uuid` | NO | — | FK → `profiles(id) ON DELETE CASCADE`; indexed |
| `category_id` | `uuid` | NO | — | FK → `categories(id) ON DELETE RESTRICT`; indexed |
| `amount` | `numeric(14,2)` | NO | — | CHECK `>= 0`; sign is encoded in `type`, not the amount |
| `type` | `text` | NO | — | `expense` / `income` |
| `title` | `text` | NO | — | CHECK non-empty |
| `merchant_name` | `text` | YES | — | |
| `description` | `text` | YES | — | |
| `payment_method` | `text` | YES | — | |
| `source` | `text` | YES | — | future: `manual` / `voice` / `import` |
| `is_recurring` | `boolean` | NO | `false` | subscription/regular-payment flag for forecasting |
| `transaction_date` | `timestamptz` | NO | `now()` | indexed |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

### `monthly_plans` — user's intention per month (only non-calculable inputs)

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `profile_id` | `uuid` | NO | — | FK → `profiles(id) ON DELETE CASCADE`; indexed |
| `month` | `integer` | NO | — | CHECK 1–12 |
| `year` | `integer` | NO | — | CHECK 2020–2100 |
| `expected_income` | `numeric(14,2)` | NO | `0` | CHECK `>= 0`; per-month to preserve income history |
| `minimum_savings_goal` | `numeric(14,2)` | NO | `0` | CHECK `>= 0` |
| `status` | `text` | NO | `'active'` | `active` / `completed` / `archived` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

- `UNIQUE(profile_id, month, year)` — one plan per month.
- `ix_monthly_plans_active_profile` — **partial unique** `(profile_id) WHERE status = 'active'` — at most one active plan per user.
- Derived values (total spent, remaining balance, achieved savings) are **never stored** — computed from `transactions`.

### `goals` — dedicated goals table

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `profile_id` | `uuid` | NO | — | FK → `profiles(id) ON DELETE CASCADE` |
| `title` | `text` | NO | — | |
| `description` | `text` | YES | — | |
| `target_amount` | `numeric(14,2)` | NO | — | CHECK `> 0` |
| `current_amount` | `numeric(14,2)` | NO | `0` | CHECK `>= 0`; live value, allocation history is a future table |
| `goal_type` | `text` | YES | — | `emergency_fund` / `purchase` / `vacation` / `investment` / `debt_repayment` / `education` / `retirement` / `custom` |
| `priority` | `text` | YES | — | free-form for now |
| `target_date` | `date` | YES | — | |
| `status` | `text` | NO | `'active'` | `active` / `completed` / `archived` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

Indexes: `ix_goals_profile`, `ix_goals_profile_status`.

> **Future (not implemented):** `goal_allocations(id, goal_id, monthly_plan_id, amount, created_at)` to preserve monthly savings-allocation history; `goals.current_amount` becomes a denormalized SUM.

---

## Access control (RLS)

- Row-Level Security **is enabled** and the original policies exist, but **the service does not rely on them**: it connects via its own SQLAlchemy session as the DB superuser, which bypasses RLS.
- The real security boundary is **`user_id` filtering in every repository read/write** (`docs/ARCHITECTURE.md`). Never add a repository method that omits the `user_id` filter.
- Defense-in-depth policies exist for the financial tables (`202608050001`): owner-scoped `SELECT`/`INSERT`/`UPDATE` on `profiles`, `transactions`, `monthly_plans`, `goals` (+ `DELETE` on `goals`), and shared `SELECT` on `categories` for `authenticated`.

---

## Migrations

Location: `alembic/versions/`. Convention: `<YYYYMMDD>_<sequence>_<slug>`; always reversible; backfill existing rows when adding non-null columns.

| revision | description |
|---|---|
| `202607310001` | create `conversations` + `messages`, enum `message_role`, RLS + policies |
| `202608020001` | make `conversations.user_id` nullable *(superseded — reverted in 202608020002)* |
| `202608020002` | conversation hardening: `message_count`, `last_message_at`, `deleted_at`; `user_id` NOT NULL again; backfill |
| `202608020003` | message hardening: `user_id`, `tool_call_id`, `tool_calls`, `status` + enum, `idempotency_key`, `metadata`, token columns, `deleted_at`; role enum + `tool`; FK → RESTRICT; index rebuild; backfill |
| `202608050001` | financial schema: enrich `profiles`; hierarchical `categories`; `transactions.is_recurring`; `monthly_plans` cleanup (`planned_expenses`/`salary_date` dropped, `savings_goal` → `minimum_savings_goal`, `status` + checks + partial-unique active index); create `goals`; RLS policies |
| `202608050002` | seed 20 default `categories` (13 expense, 7 income) with `is_system=true` |

> The core financial tables (`profiles`, `categories`, `transactions`, `monthly_plans`) were created by Supabase migration `20260728184215`, outside this Alembic chain. `202608050001` alters those tables in place, so its `downgrade()` restores the pre-enrichment shape.

**Current head: `202608050002`.**

Commands:

```bash
uv run alembic upgrade head     # apply all pending
uv run alembic downgrade -1     # roll back one
uv run alembic current          # DB's current revision
uv run alembic heads            # latest revision
uv run alembic revision -m "description"
```

Alembic targets Supabase via `DATABASE_URL` (`ai_service/db/session.py`). A `postgresql://` URL is normalized to `postgresql+asyncpg://` at runtime.
