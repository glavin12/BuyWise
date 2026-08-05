"""financial schema enrichment

Revision ID: 202608050001
Revises: 202608020003
Create Date: 2026-08-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608050001"
down_revision: Union[str, None] = "202608020003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- profiles: enrich with permanent + merged financial-preference fields
    op.add_column("profiles", sa.Column("income_type", sa.Text(), nullable=True), schema="public")
    op.add_column("profiles", sa.Column("salary_day", sa.Integer(), nullable=True), schema="public")
    op.add_column(
        "profiles",
        sa.Column("timezone", sa.Text(), server_default=sa.text("'Asia/Kolkata'"), nullable=False),
        schema="public",
    )
    op.add_column(
        "profiles",
        sa.Column("onboarding_complete", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="public",
    )
    op.add_column("profiles", sa.Column("savings_target_percent", sa.Integer(), nullable=True), schema="public")
    op.add_column("profiles", sa.Column("investment_style", sa.Text(), nullable=True), schema="public")
    op.add_column(
        "profiles",
        sa.Column("budget_alerts", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        schema="public",
    )
    op.create_check_constraint(
        "profiles_salary_day_check",
        "profiles",
        "salary_day IS NULL OR (salary_day >= 1 AND salary_day <= 31)",
        schema="public",
    )
    op.create_check_constraint(
        "profiles_income_type_check",
        "profiles",
        "income_type IS NULL OR income_type IN "
        "('salaried', 'freelancer', 'business_owner', 'retired', 'other')",
        schema="public",
    )
    op.create_check_constraint(
        "profiles_savings_target_percent_check",
        "profiles",
        "savings_target_percent IS NULL OR "
        "(savings_target_percent >= 0 AND savings_target_percent <= 100)",
        schema="public",
    )
    op.create_check_constraint(
        "profiles_investment_style_check",
        "profiles",
        "investment_style IS NULL OR investment_style IN "
        "('conservative', 'moderate', 'aggressive')",
        schema="public",
    )

    # --- categories: hierarchical parents + system flag
    op.add_column(
        "categories",
        sa.Column(
            "parent_category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="public",
    )
    op.add_column(
        "categories",
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="public",
    )
    op.create_index(
        "ix_categories_parent_category_id",
        "categories",
        ["parent_category_id"],
        unique=False,
        schema="public",
    )
    op.create_check_constraint(
        "categories_name_not_empty_check",
        "categories",
        "length(name) > 0",
        schema="public",
    )
    op.create_check_constraint(
        "categories_parent_not_self_check",
        "categories",
        "parent_category_id IS NULL OR parent_category_id <> id",
        schema="public",
    )

    # --- transactions: recurring flag
    op.add_column(
        "transactions",
        sa.Column("is_recurring", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="public",
    )
    op.create_check_constraint(
        "transactions_title_not_empty_check",
        "transactions",
        "length(title) > 0",
        schema="public",
    )

    # --- monthly_plans: drop derived columns, rename savings_goal, add status + checks
    op.drop_column("monthly_plans", "planned_expenses", schema="public")
    op.drop_column("monthly_plans", "salary_date", schema="public")
    op.alter_column(
        "monthly_plans",
        "savings_goal",
        new_column_name="minimum_savings_goal",
        existing_type=sa.Numeric(),
        schema="public",
    )
    op.add_column(
        "monthly_plans",
        sa.Column("status", sa.Text(), server_default=sa.text("'active'"), nullable=False),
        schema="public",
    )
    op.create_check_constraint(
        "monthly_plans_year_check",
        "monthly_plans",
        "year >= 2020 AND year <= 2100",
        schema="public",
    )
    op.create_check_constraint(
        "monthly_plans_expected_income_check",
        "monthly_plans",
        "expected_income >= 0",
        schema="public",
    )
    op.create_check_constraint(
        "monthly_plans_minimum_savings_goal_check",
        "monthly_plans",
        "minimum_savings_goal >= 0",
        schema="public",
    )
    op.create_check_constraint(
        "monthly_plans_status_check",
        "monthly_plans",
        "status IN ('active', 'completed', 'archived')",
        schema="public",
    )
    op.execute(
        "create unique index ix_monthly_plans_active_profile "
        "on public.monthly_plans (profile_id) where status = 'active'"
    )

    # --- goals: new table
    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("goal_type", sa.Text(), nullable=True),
        sa.Column("priority", sa.Text(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("target_amount > 0", name="goals_target_amount_check"),
        sa.CheckConstraint("current_amount >= 0", name="goals_current_amount_check"),
        sa.CheckConstraint(
            "goal_type IS NULL OR goal_type IN "
            "('emergency_fund', 'purchase', 'vacation', 'investment', "
            "'debt_repayment', 'education', 'retirement', 'custom')",
            name="goals_goal_type_check",
        ),
        sa.CheckConstraint("status IN ('active', 'completed', 'archived')", name="goals_status_check"),
        sa.ForeignKeyConstraint(["profile_id"], ["public.profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index("ix_goals_profile", "goals", ["profile_id"], unique=False, schema="public")
    op.create_index(
        "ix_goals_profile_status",
        "goals",
        ["profile_id", "status"],
        unique=False,
        schema="public",
    )

    # --- RLS policies (defense-in-depth; backend repo layer remains the boundary)
    op.execute("create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()))")
    op.execute("create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()))")
    op.execute("create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()))")

    op.execute("create policy categories_select_all on public.categories for select to authenticated using (true)")

    op.execute("create policy transactions_select_own on public.transactions for select to authenticated using (profile_id = (select auth.uid()))")
    op.execute("create policy transactions_insert_own on public.transactions for insert to authenticated with check (profile_id = (select auth.uid()))")
    op.execute("create policy transactions_update_own on public.transactions for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()))")

    op.execute("create policy monthly_plans_select_own on public.monthly_plans for select to authenticated using (profile_id = (select auth.uid()))")
    op.execute("create policy monthly_plans_insert_own on public.monthly_plans for insert to authenticated with check (profile_id = (select auth.uid()))")
    op.execute("create policy monthly_plans_update_own on public.monthly_plans for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()))")

    op.execute("create policy goals_select_own on public.goals for select to authenticated using (profile_id = (select auth.uid()))")
    op.execute("create policy goals_insert_own on public.goals for insert to authenticated with check (profile_id = (select auth.uid()))")
    op.execute("create policy goals_update_own on public.goals for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()))")
    op.execute("create policy goals_delete_own on public.goals for delete to authenticated using (profile_id = (select auth.uid()))")


def downgrade() -> None:
    # --- RLS policies
    op.execute("drop policy if exists goals_delete_own on public.goals")
    op.execute("drop policy if exists goals_update_own on public.goals")
    op.execute("drop policy if exists goals_insert_own on public.goals")
    op.execute("drop policy if exists goals_select_own on public.goals")
    op.execute("drop policy if exists monthly_plans_update_own on public.monthly_plans")
    op.execute("drop policy if exists monthly_plans_insert_own on public.monthly_plans")
    op.execute("drop policy if exists monthly_plans_select_own on public.monthly_plans")
    op.execute("drop policy if exists transactions_update_own on public.transactions")
    op.execute("drop policy if exists transactions_insert_own on public.transactions")
    op.execute("drop policy if exists transactions_select_own on public.transactions")
    op.execute("drop policy if exists categories_select_all on public.categories")
    op.execute("drop policy if exists profiles_update_own on public.profiles")
    op.execute("drop policy if exists profiles_insert_own on public.profiles")
    op.execute("drop policy if exists profiles_select_own on public.profiles")

    # --- goals
    op.drop_index("ix_goals_profile_status", table_name="goals", schema="public")
    op.drop_index("ix_goals_profile", table_name="goals", schema="public")
    op.drop_table("goals", schema="public")

    # --- monthly_plans
    op.execute("drop index if exists ix_monthly_plans_active_profile")
    op.drop_constraint("monthly_plans_status_check", "monthly_plans", type_="check", schema="public")
    op.drop_constraint("monthly_plans_minimum_savings_goal_check", "monthly_plans", type_="check", schema="public")
    op.drop_constraint("monthly_plans_expected_income_check", "monthly_plans", type_="check", schema="public")
    op.drop_constraint("monthly_plans_year_check", "monthly_plans", type_="check", schema="public")
    op.drop_column("monthly_plans", "status", schema="public")
    op.alter_column(
        "monthly_plans",
        "minimum_savings_goal",
        new_column_name="savings_goal",
        existing_type=sa.Numeric(),
        schema="public",
    )
    op.add_column(
        "monthly_plans",
        sa.Column("salary_date", sa.Date(), nullable=True),
        schema="public",
    )
    op.add_column(
        "monthly_plans",
        sa.Column("planned_expenses", sa.Numeric(), server_default=sa.text("0"), nullable=False),
        schema="public",
    )

    # --- transactions
    op.drop_constraint("transactions_title_not_empty_check", "transactions", type_="check", schema="public")
    op.drop_column("transactions", "is_recurring", schema="public")

    # --- categories
    op.drop_constraint("categories_parent_not_self_check", "categories", type_="check", schema="public")
    op.drop_constraint("categories_name_not_empty_check", "categories", type_="check", schema="public")
    op.drop_index("ix_categories_parent_category_id", table_name="categories", schema="public")
    op.drop_constraint("categories_parent_category_id_fkey", "categories", type_="foreignkey", schema="public")
    op.drop_column("categories", "is_system", schema="public")
    op.drop_column("categories", "parent_category_id", schema="public")

    # --- profiles
    op.drop_constraint("profiles_investment_style_check", "profiles", type_="check", schema="public")
    op.drop_constraint("profiles_savings_target_percent_check", "profiles", type_="check", schema="public")
    op.drop_constraint("profiles_income_type_check", "profiles", type_="check", schema="public")
    op.drop_constraint("profiles_salary_day_check", "profiles", type_="check", schema="public")
    op.drop_column("profiles", "budget_alerts", schema="public")
    op.drop_column("profiles", "investment_style", schema="public")
    op.drop_column("profiles", "savings_target_percent", schema="public")
    op.drop_column("profiles", "onboarding_complete", schema="public")
    op.drop_column("profiles", "timezone", schema="public")
    op.drop_column("profiles", "salary_day", schema="public")
    op.drop_column("profiles", "income_type", schema="public")
