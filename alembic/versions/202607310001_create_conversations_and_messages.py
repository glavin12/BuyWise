"""create conversations and messages

Revision ID: 202607310001
Revises:
Create Date: 2026-07-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607310001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

message_role = postgresql.ENUM("user", "assistant", "system", name="message_role", create_type=False)


def upgrade() -> None:
    op.execute("create extension if not exists pgcrypto")
    op.execute("create type message_role as enum ('user', 'assistant', 'system')")

    op.create_table(
        "conversations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index(
        "ix_conversations_user_id",
        "conversations",
        ["user_id"],
        unique=False,
        schema="public",
    )

    op.create_table(
        "messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["public.conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index(
        "ix_messages_conversation_id",
        "messages",
        ["conversation_id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_messages_conversation_created_at",
        "messages",
        ["conversation_id", "created_at"],
        unique=False,
        schema="public",
    )

    op.execute("alter table public.conversations enable row level security")
    op.execute("alter table public.messages enable row level security")

    op.execute(
        """
        create policy conversations_select_own
        on public.conversations
        for select
        to authenticated
        using ((select auth.uid()) = user_id)
        """
    )
    op.execute(
        """
        create policy conversations_insert_own
        on public.conversations
        for insert
        to authenticated
        with check ((select auth.uid()) = user_id)
        """
    )
    op.execute(
        """
        create policy conversations_update_own
        on public.conversations
        for update
        to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
        """
    )
    op.execute(
        """
        create policy conversations_delete_own
        on public.conversations
        for delete
        to authenticated
        using ((select auth.uid()) = user_id)
        """
    )
    op.execute(
        """
        create policy messages_select_own
        on public.messages
        for select
        to authenticated
        using (
            exists (
                select 1
                from public.conversations
                where conversations.id = messages.conversation_id
                and conversations.user_id = (select auth.uid())
            )
        )
        """
    )
    op.execute(
        """
        create policy messages_insert_own
        on public.messages
        for insert
        to authenticated
        with check (
            exists (
                select 1
                from public.conversations
                where conversations.id = messages.conversation_id
                and conversations.user_id = (select auth.uid())
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("drop policy if exists messages_insert_own on public.messages")
    op.execute("drop policy if exists messages_select_own on public.messages")
    op.execute("drop policy if exists conversations_delete_own on public.conversations")
    op.execute("drop policy if exists conversations_update_own on public.conversations")
    op.execute("drop policy if exists conversations_insert_own on public.conversations")
    op.execute("drop policy if exists conversations_select_own on public.conversations")

    op.drop_index("ix_messages_conversation_created_at", table_name="messages", schema="public")
    op.drop_index("ix_messages_conversation_id", table_name="messages", schema="public")
    op.drop_table("messages", schema="public")

    op.drop_index("ix_conversations_user_id", table_name="conversations", schema="public")
    op.drop_table("conversations", schema="public")

    op.execute("drop type if exists message_role")
