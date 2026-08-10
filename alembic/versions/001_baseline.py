"""Create the BuyWise manual expense tracker baseline.

This migration intentionally rebuilds the application schema. It is suitable
for a fresh database only; existing application data is not migrated.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enable_owner_rls(table: str, owner_column: str = "user_id", *, delete: bool = True) -> None:
    op.execute(f"alter table public.{table} enable row level security")
    op.execute(
        f"create policy {table}_select_own on public.{table} for select to authenticated "
        f"using ((select auth.uid()) = {owner_column})"
    )
    op.execute(
        f"create policy {table}_insert_own on public.{table} for insert to authenticated "
        f"with check ((select auth.uid()) = {owner_column})"
    )
    op.execute(
        f"create policy {table}_update_own on public.{table} for update to authenticated "
        f"using ((select auth.uid()) = {owner_column}) "
        f"with check ((select auth.uid()) = {owner_column})"
    )
    if delete:
        op.execute(
            f"create policy {table}_delete_own on public.{table} for delete to authenticated "
            f"using ((select auth.uid()) = {owner_column})"
        )


def upgrade() -> None:
    op.execute("create extension if not exists pgcrypto")
    op.execute("create type message_role as enum ('user', 'assistant', 'system', 'tool')")
    op.execute("create type message_status as enum ('pending', 'completed', 'failed')")

    uuid_type = postgresql.UUID(as_uuid=True)
    message_role = postgresql.ENUM(
        "user", "assistant", "system", "tool", name="message_role", create_type=False
    )
    message_status = postgresql.ENUM(
        "pending", "completed", "failed", name="message_status", create_type=False
    )

    op.create_table(
        "profiles",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("full_name", sa.Text(), nullable=True),
        sa.Column("currency", sa.Text(), server_default=sa.text("'INR'"), nullable=False),
        sa.Column("income_type", sa.Text(), nullable=True),
        sa.Column("salary_day", sa.Integer(), nullable=True),
        sa.Column("timezone", sa.Text(), server_default=sa.text("'Asia/Kolkata'"), nullable=False),
        sa.Column("onboarding_complete", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("savings_target_percent", sa.Integer(), nullable=True),
        sa.Column("investment_style", sa.Text(), nullable=True),
        sa.Column("budget_alerts", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "salary_day IS NULL OR (salary_day >= 1 AND salary_day <= 31)",
            name="profiles_salary_day_check",
        ),
        sa.CheckConstraint(
            "income_type IS NULL OR income_type IN ('salaried', 'freelancer', 'business_owner', 'retired', 'other')",
            name="profiles_income_type_check",
        ),
        sa.CheckConstraint(
            "savings_target_percent IS NULL OR (savings_target_percent >= 0 AND savings_target_percent <= 100)",
            name="profiles_savings_target_percent_check",
        ),
        sa.CheckConstraint(
            "investment_style IS NULL OR investment_style IN ('conservative', 'moderate', 'aggressive')",
            name="profiles_investment_style_check",
        ),
        sa.ForeignKeyConstraint(["id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )

    op.create_table(
        "conversations",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("message_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"], schema="public")
    op.create_index(
        "ix_conversations_user_deleted_at",
        "conversations",
        ["user_id", "deleted_at"],
        schema="public",
    )

    op.create_table(
        "messages",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("conversation_id", uuid_type, nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("role", message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("tool_call_id", sa.Text(), nullable=True),
        sa.Column("status", message_status, server_default=sa.text("'completed'"), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["conversation_id"], ["public.conversations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"], schema="public")
    op.create_index("ix_messages_user_id", "messages", ["user_id"], schema="public")
    op.create_index(
        "ix_messages_conversation_created_at_id",
        "messages",
        ["conversation_id", "created_at", "id"],
        schema="public",
    )
    op.create_index(
        "ix_messages_idempotency_key",
        "messages",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        schema="public",
    )

    op.create_table(
        "accounts",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("account_type", sa.Text(), nullable=False),
        sa.Column("currency", sa.Text(), server_default=sa.text("'INR'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(name) > 0", name="accounts_name_not_empty_check"),
        sa.CheckConstraint(
            "account_type IN ('checking', 'savings', 'cash', 'credit_card')",
            name="accounts_account_type_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"], schema="public")

    op.create_table(
        "categories",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(name) > 0", name="categories_name_not_empty_check"),
        sa.CheckConstraint("type IN ('expense', 'income')", name="categories_type_check"),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", "type", name="uq_categories_user_name_type"),
        schema="public",
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"], schema="public")

    op.create_table(
        "payees",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("normalized_name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(name) > 0", name="payees_name_not_empty_check"),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "normalized_name", name="uq_payees_user_normalized_name"),
        schema="public",
    )
    op.create_index("ix_payees_user_id", "payees", ["user_id"], schema="public")

    op.create_table(
        "transactions",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("account_id", uuid_type, nullable=False),
        sa.Column("category_id", uuid_type, nullable=True),
        sa.Column("payee_id", uuid_type, nullable=True),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.Text(), server_default=sa.text("'INR'"), nullable=False),
        sa.Column("transaction_type", sa.Text(), nullable=False),
        sa.Column("transaction_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cleared_status", sa.Text(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("transfer_group_id", uuid_type, nullable=True),
        sa.Column("transfer_direction", sa.Text(), nullable=True),
        sa.Column("parent_transaction_id", uuid_type, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount >= 0", name="transactions_amount_check"),
        sa.CheckConstraint(
            "transaction_type IN ('expense', 'income', 'transfer', 'starting_balance')",
            name="transactions_type_check",
        ),
        sa.CheckConstraint(
            "cleared_status IN ('pending', 'cleared')",
            name="transactions_cleared_status_check",
        ),
        sa.CheckConstraint(
            "parent_transaction_id IS NULL OR parent_transaction_id <> id",
            name="transactions_parent_not_self_check",
        ),
        sa.CheckConstraint(
            "(transaction_type != 'transfer') OR (transfer_group_id IS NOT NULL AND transfer_direction IN ('in', 'out'))",
            name="transactions_transfer_fields_check",
        ),
        sa.CheckConstraint(
            "(transaction_type = 'transfer') OR transfer_direction IS NULL",
            name="transactions_non_transfer_direction_check",
        ),
        sa.CheckConstraint(
            "(transaction_type IN ('transfer', 'starting_balance')) OR (category_id IS NOT NULL)",
            name="transactions_category_required_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["public.accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["category_id"], ["public.categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["payee_id"], ["public.payees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_transaction_id"], ["public.transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    for name, columns in (
        ("ix_transactions_user_id", ["user_id"]),
        ("ix_transactions_account_id", ["account_id"]),
        ("ix_transactions_category_id", ["category_id"]),
        ("ix_transactions_payee_id", ["payee_id"]),
        ("ix_transactions_transaction_date", ["transaction_date"]),
        ("ix_transactions_user_date", ["user_id", "transaction_date"]),
        ("ix_transactions_user_type", ["user_id", "transaction_type"]),
    ):
        op.create_index(name, "transactions", columns, schema="public")
    op.create_index(
        "ix_transactions_transfer_group_id",
        "transactions",
        ["transfer_group_id"],
        postgresql_where=sa.text("transfer_group_id IS NOT NULL"),
        schema="public",
    )
    op.create_index(
        "ix_transactions_parent_transaction_id",
        "transactions",
        ["parent_transaction_id"],
        schema="public",
    )

    op.create_table(
        "budget_entries",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("category_id", uuid_type, nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("budgeted_amount", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("month >= 1 AND month <= 12", name="budget_entries_month_check"),
        sa.CheckConstraint("year >= 2020 AND year <= 2100", name="budget_entries_year_check"),
        sa.CheckConstraint("budgeted_amount >= 0", name="budget_entries_amount_check"),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["public.categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "category_id", "month", "year", name="uq_budget_entries_user_category_month"
        ),
        schema="public",
    )
    op.create_index(
        "ix_budget_entries_user_month",
        "budget_entries",
        ["user_id", "month", "year"],
        schema="public",
    )
    op.create_index(
        "ix_budget_entries_category_id",
        "budget_entries",
        ["category_id"],
        schema="public",
    )

    op.create_table(
        "goals",
        sa.Column("id", uuid_type, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", uuid_type, nullable=False),
        sa.Column("category_id", uuid_type, nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_amount", sa.BigInteger(), nullable=False),
        sa.Column("current_amount", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("goal_type", sa.Text(), nullable=True),
        sa.Column("priority", sa.Text(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(title) > 0", name="goals_title_not_empty_check"),
        sa.CheckConstraint("target_amount > 0", name="goals_target_amount_check"),
        sa.CheckConstraint("current_amount >= 0", name="goals_current_amount_check"),
        sa.CheckConstraint(
            "goal_type IS NULL OR goal_type IN ('emergency_fund', 'purchase', 'vacation', 'investment', 'debt_repayment', 'education', 'retirement', 'custom')",
            name="goals_goal_type_check",
        ),
        sa.CheckConstraint("status IN ('active', 'completed', 'archived')", name="goals_status_check"),
        sa.ForeignKeyConstraint(["user_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["public.categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"], schema="public")
    op.create_index("ix_goals_user_status", "goals", ["user_id", "status"], schema="public")
    op.create_index("ix_goals_category_id", "goals", ["category_id"], schema="public")

    _enable_owner_rls("profiles", "id", delete=False)
    _enable_owner_rls("conversations", delete=True)
    op.execute("alter table public.messages enable row level security")
    op.execute(
        """
        create policy messages_select_own on public.messages
        for select to authenticated
        using (
            (select auth.uid()) = user_id
            and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id
                and c.user_id = (select auth.uid())
            )
        )
        """
    )
    op.execute(
        """
        create policy messages_insert_own on public.messages
        for insert to authenticated
        with check (
            (select auth.uid()) = user_id
            and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id
                and c.user_id = (select auth.uid())
            )
        )
        """
    )
    op.execute(
        """
        create policy messages_update_own on public.messages
        for update to authenticated
        using (
            (select auth.uid()) = user_id
            and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id
                and c.user_id = (select auth.uid())
            )
        )
        with check (
            (select auth.uid()) = user_id
            and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id
                and c.user_id = (select auth.uid())
            )
        )
        """
    )
    op.execute(
        """
        create policy messages_delete_own on public.messages
        for delete to authenticated
        using (
            (select auth.uid()) = user_id
            and exists (
                select 1 from public.conversations c
                where c.id = messages.conversation_id
                and c.user_id = (select auth.uid())
            )
        )
        """
    )
    _enable_owner_rls("accounts")
    _enable_owner_rls("categories")
    _enable_owner_rls("payees")
    _enable_owner_rls("transactions")
    _enable_owner_rls("budget_entries")
    _enable_owner_rls("goals")
    op.execute("alter table if exists public.alembic_version enable row level security")
    op.execute(
        "create policy alembic_version_service_role on public.alembic_version "
        "for all to service_role using (true) with check (true)"
    )


def downgrade() -> None:
    op.execute("drop policy if exists alembic_version_service_role on public.alembic_version")
    for table in (
        "goals",
        "budget_entries",
        "transactions",
        "payees",
        "categories",
        "accounts",
        "messages",
        "conversations",
        "profiles",
    ):
        op.execute(f"drop policy if exists {table}_delete_own on public.{table}")
        op.execute(f"drop policy if exists {table}_update_own on public.{table}")
        op.execute(f"drop policy if exists {table}_insert_own on public.{table}")
        op.execute(f"drop policy if exists {table}_select_own on public.{table}")

    op.drop_index("ix_goals_user_status", table_name="goals", schema="public")
    op.drop_index("ix_goals_user_id", table_name="goals", schema="public")
    op.drop_index("ix_goals_category_id", table_name="goals", schema="public")
    op.drop_table("goals", schema="public")
    op.drop_index("ix_budget_entries_user_month", table_name="budget_entries", schema="public")
    op.drop_index("ix_budget_entries_category_id", table_name="budget_entries", schema="public")
    op.drop_table("budget_entries", schema="public")
    op.drop_index("ix_transactions_transfer_group_id", table_name="transactions", schema="public")
    op.drop_index("ix_transactions_parent_transaction_id", table_name="transactions", schema="public")
    for name in (
        "ix_transactions_user_type",
        "ix_transactions_user_date",
        "ix_transactions_transaction_date",
        "ix_transactions_payee_id",
        "ix_transactions_category_id",
        "ix_transactions_account_id",
        "ix_transactions_user_id",
    ):
        op.drop_index(name, table_name="transactions", schema="public")
    op.drop_table("transactions", schema="public")
    op.drop_index("ix_payees_user_id", table_name="payees", schema="public")
    op.drop_table("payees", schema="public")
    op.drop_index("ix_categories_user_id", table_name="categories", schema="public")
    op.drop_table("categories", schema="public")
    op.drop_index("ix_accounts_user_id", table_name="accounts", schema="public")
    op.drop_table("accounts", schema="public")
    op.drop_index("ix_messages_idempotency_key", table_name="messages", schema="public")
    op.drop_index("ix_messages_conversation_created_at_id", table_name="messages", schema="public")
    op.drop_index("ix_messages_user_id", table_name="messages", schema="public")
    op.drop_index("ix_messages_conversation_id", table_name="messages", schema="public")
    op.drop_table("messages", schema="public")
    op.drop_index("ix_conversations_user_deleted_at", table_name="conversations", schema="public")
    op.drop_index("ix_conversations_user_id", table_name="conversations", schema="public")
    op.drop_table("conversations", schema="public")
    op.drop_table("profiles", schema="public")
    op.execute("drop type if exists message_status")
    op.execute("drop type if exists message_role")
