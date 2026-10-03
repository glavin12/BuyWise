"""Exactly-once transaction creates: transactions.idempotency_key.

A client that times out while saving an expense retries, and the first request may have completed,
so the expense would be logged twice. ``POST /transactions`` now takes an optional client-generated
``idempotency_key``; a repeat of a key the same user already used returns the first transaction.

Additive only: one nullable column and a partial unique index (per user, only rows that carry a key).
Existing rows keep ``NULL`` and are untouched.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("idempotency_key", sa.Text(), nullable=True), schema="public")
    op.create_index(
        "ix_transactions_user_idempotency_key",
        "transactions",
        ["user_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        schema="public",
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_user_idempotency_key", table_name="transactions", schema="public")
    op.drop_column("transactions", "idempotency_key", schema="public")
