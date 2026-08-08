"""conversation hardening

Revision ID: 202608020002
Revises: 202608020001
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608020002"
down_revision: Union[str, None] = "202608020001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("message_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        schema="public",
    )
    op.add_column(
        "conversations",
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )
    op.add_column(
        "conversations",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )

    op.execute("delete from public.conversations where user_id is null")

    op.alter_column(
        "conversations",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        nullable=False,
        schema="public",
    )

    op.execute(
        """
        update public.conversations c
        set message_count = sub.cnt,
            last_message_at = coalesce(sub.last_msg, c.created_at)
        from (
            select conversation_id, count(*) as cnt, max(created_at) as last_msg
            from public.messages
            group by conversation_id
        ) sub
        where c.id = sub.conversation_id
        """
    )


def downgrade() -> None:
    op.drop_column("conversations", "deleted_at", schema="public")
    op.drop_column("conversations", "last_message_at", schema="public")
    op.drop_column("conversations", "message_count", schema="public")

    op.alter_column(
        "conversations",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        existing_nullable=False,
        nullable=True,
        schema="public",
    )
