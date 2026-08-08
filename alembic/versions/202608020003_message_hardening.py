"""message hardening

Revision ID: 202608020003
Revises: 202608020002
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608020003"
down_revision: Union[str, None] = "202608020002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

message_status = postgresql.ENUM(
    "pending", "completed", "failed", name="message_status", create_type=False
)


def upgrade() -> None:
    op.execute("alter type message_role add value if not exists 'tool'")

    op.execute("create type message_status as enum ('pending', 'completed', 'failed')")

    op.add_column(
        "messages",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("tool_call_id", sa.Text(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column(
            "status",
            message_status,
            server_default=sa.text("'completed'"),
            nullable=False,
        ),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("idempotency_key", sa.Text(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        schema="public",
    )
    op.add_column(
        "messages",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        schema="public",
    )

    op.execute(
        """
        update public.messages m
        set user_id = c.user_id
        from public.conversations c
        where m.conversation_id = c.id
        """
    )
    op.alter_column(
        "messages",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        nullable=False,
        schema="public",
    )

    op.drop_constraint(
        "messages_conversation_id_fkey", "messages", type_="foreignkey", schema="public"
    )
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["id"],
        ondelete="RESTRICT",
        source_schema="public",
        referent_schema="public",
    )

    op.drop_index("ix_messages_conversation_id", table_name="messages", schema="public")
    op.drop_index("ix_messages_conversation_created_at", table_name="messages", schema="public")
    op.create_index(
        "ix_messages_conversation_created_at_id",
        "messages",
        ["conversation_id", "created_at", "id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_messages_user_id",
        "messages",
        ["user_id"],
        unique=False,
        schema="public",
    )
    op.execute(
        "create unique index ix_messages_idempotency_key on public.messages (idempotency_key) "
        "where idempotency_key is not null"
    )


def downgrade() -> None:
    op.execute("drop index if exists ix_messages_idempotency_key")
    op.drop_index("ix_messages_user_id", table_name="messages", schema="public")
    op.drop_index("ix_messages_conversation_created_at_id", table_name="messages", schema="public")
    op.create_index(
        "ix_messages_conversation_created_at",
        "messages",
        ["conversation_id", "created_at"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_messages_conversation_id",
        "messages",
        ["conversation_id"],
        unique=False,
        schema="public",
    )

    op.drop_constraint(
        "messages_conversation_id_fkey", "messages", type_="foreignkey", schema="public"
    )
    op.create_foreign_key(
        "messages_conversation_id_fkey",
        "messages",
        "conversations",
        ["conversation_id"],
        ["id"],
        ondelete="CASCADE",
        source_schema="public",
        referent_schema="public",
    )

    op.drop_column("messages", "deleted_at", schema="public")
    op.drop_column("messages", "total_tokens", schema="public")
    op.drop_column("messages", "completion_tokens", schema="public")
    op.drop_column("messages", "prompt_tokens", schema="public")
    op.drop_column("messages", "metadata", schema="public")
    op.drop_column("messages", "idempotency_key", schema="public")
    op.drop_column("messages", "status", schema="public")
    op.drop_column("messages", "tool_calls", schema="public")
    op.drop_column("messages", "tool_call_id", schema="public")
    op.drop_column("messages", "user_id", schema="public")

    op.execute("drop type if exists message_status")
    # note: message_role enum value 'tool' cannot be dropped; left in place on downgrade
