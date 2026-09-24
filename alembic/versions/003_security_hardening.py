"""Security hardening: close the Supabase Data API and scope idempotency keys per user.

1. The baseline gave the ``authenticated`` role (Supabase's default table
   grants plus owner-only RLS policies) INSERT/UPDATE/DELETE on every app
   table. The Supabase URL and anon key ship inside the web and mobile
   bundles, so any signed-in user could call ``/rest/v1/<table>`` with their own
   JWT and skip every backend rule: reference another user's category or payee,
   forge assistant/tool ``messages``, store invalid profile values, dodge rate
   limits. Neither client uses that path (Supabase is used for auth only) and
   the backend connects as the table owner, which REVOKE does not affect, so
   all direct access for ``anon`` and ``authenticated`` is removed. RLS stays
   enabled as defence in depth.

2. ``messages.idempotency_key`` was unique across ALL users, so one user's key
   could make another user's send fail. It is now unique per user, and only among
   live rows, matching ``MessageRepository.get_by_idempotency_key``.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_APP_TABLES = (
    "profiles",
    "conversations",
    "messages",
    "categories",
    "payees",
    "transactions",
    "budget_entries",
    "goals",
)


def upgrade() -> None:
    for table in _APP_TABLES:
        op.execute(f"revoke all on public.{table} from anon, authenticated")

    op.drop_index("ix_messages_idempotency_key", table_name="messages", schema="public")
    op.create_index(
        "ix_messages_user_idempotency_key",
        "messages",
        ["user_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL AND deleted_at IS NULL"),
        schema="public",
    )


def downgrade() -> None:
    op.drop_index("ix_messages_user_idempotency_key", table_name="messages", schema="public")
    op.create_index(
        "ix_messages_idempotency_key",
        "messages",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        schema="public",
    )

    # Mirror the baseline: Supabase's default privileges gave both API roles
    # full table access, with the RLS policies doing the row filtering.
    for table in _APP_TABLES:
        op.execute(f"grant all on public.{table} to anon, authenticated")
