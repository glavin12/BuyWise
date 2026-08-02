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

## Access control (RLS)

- Row-Level Security **is enabled** and the original policies exist, but **the service does not rely on them**: it connects via its own SQLAlchemy session as the DB superuser, which bypasses RLS.
- The real security boundary is **`user_id` filtering in every repository read/write** (`docs/ARCHITECTURE.md`). Never add a repository method that omits the `user_id` filter.

---

## Migrations

Location: `alembic/versions/`. Convention: `<YYYYMMDD>_<sequence>_<slug>`; always reversible; backfill existing rows when adding non-null columns.

| revision | description |
|---|---|
| `202607310001` | create `conversations` + `messages`, enum `message_role`, RLS + policies |
| `202608020001` | make `conversations.user_id` nullable *(superseded — reverted in 202608020002)* |
| `202608020002` | conversation hardening: `message_count`, `last_message_at`, `deleted_at`; `user_id` NOT NULL again; backfill |
| `202608020003` | message hardening: `user_id`, `tool_call_id`, `tool_calls`, `status` + enum, `idempotency_key`, `metadata`, token columns, `deleted_at`; role enum + `tool`; FK → RESTRICT; index rebuild; backfill |

**Current head: `202608020003`.**

Commands:

```bash
uv run alembic upgrade head     # apply all pending
uv run alembic downgrade -1     # roll back one
uv run alembic current          # DB's current revision
uv run alembic heads            # latest revision
uv run alembic revision -m "description"
```

Alembic targets Supabase via `DATABASE_URL` (`ai_service/db/session.py`). A `postgresql://` URL is normalized to `postgresql+asyncpg://` at runtime.
