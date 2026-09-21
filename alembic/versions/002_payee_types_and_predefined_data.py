"""Add payee.type (expense/income) and backfill predefined categories/payees.

Existing payees are typed by inference from their transaction history (income
if only ever used on income transactions, expense otherwise/by default) since
the column did not exist before. Existing profiles that predate the expanded
default lists in category_repository.py / payee_repository.py are backfilled
additively — never overwriting or removing rows a user already has.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Keep in sync with ai_service/repositories/category_repository.py DEFAULT_CATEGORIES
DEFAULT_CATEGORIES = (
    ("Food", "expense", "food", "#F97316"),
    ("Transport", "expense", "transport", "#3B82F6"),
    ("Shopping", "expense", "shopping", "#8B5CF6"),
    ("Bills", "expense", "bills", "#EF4444"),
    ("Entertainment", "expense", "entertainment", "#EC4899"),
    ("Healthcare", "expense", "healthcare", "#14B8A6"),
    ("Education", "expense", "education", "#6366F1"),
    ("Travel", "expense", "travel", "#0EA5E9"),
    ("Personal Care", "expense", "personal-care", "#F43F5E"),
    ("Gifts & Donations", "expense", "gifts", "#D946EF"),
    ("Family", "expense", "family", "#84CC16"),
    ("Fees & Charges", "expense", "fees", "#64748B"),
    ("Other Expense", "expense", "other", "#94A3B8"),
    ("Groceries", "expense", "groceries", "#F59E0B"),
    ("Restaurants", "expense", "restaurants", "#FB7185"),
    ("Coffee", "expense", "coffee", "#B45309"),
    ("Rent", "expense", "rent", "#7C3AED"),
    ("Electricity", "expense", "electricity", "#FACC15"),
    ("Internet", "expense", "internet", "#0891B2"),
    ("Mobile/Phone", "expense", "mobile-phone", "#0EA5E9"),
    ("Fuel", "expense", "fuel", "#DC2626"),
    ("Public Transit", "expense", "public-transit", "#2563EB"),
    ("Clothing", "expense", "clothing", "#DB2777"),
    ("Electronics", "expense", "electronics", "#4F46E5"),
    ("Insurance", "expense", "insurance", "#0D9488"),
    ("Subscriptions", "expense", "subscriptions", "#9333EA"),
    ("Fitness", "expense", "fitness", "#16A34A"),
    ("Household", "expense", "household", "#78716C"),
    ("Pets", "expense", "pets", "#CA8A04"),
    ("Salary", "income", "salary", "#22C55E"),
    ("Freelance", "income", "freelance", "#10B981"),
    ("Business", "income", "business", "#059669"),
    ("Investments", "income", "investments", "#16A34A"),
    ("Interest", "income", "interest", "#65A30D"),
    ("Refunds", "income", "refunds", "#84CC16"),
    ("Other Income", "income", "other-income", "#A3E635"),
)

# Keep in sync with ai_service/repositories/payee_repository.py PREDEFINED_PAYEES
PREDEFINED_PAYEES = (
    ("Amazon", "expense"),
    ("Flipkart", "expense"),
    ("DMart", "expense"),
    ("Big Bazaar", "expense"),
    ("Swiggy", "expense"),
    ("Zomato", "expense"),
    ("Starbucks", "expense"),
    ("Uber", "expense"),
    ("Ola", "expense"),
    ("Netflix", "expense"),
    ("Spotify", "expense"),
    ("Apple", "expense"),
    ("Google", "expense"),
    ("Local Grocery Store", "expense"),
    ("Pharmacy", "expense"),
    ("Restaurant", "expense"),
    ("Landlord", "expense"),
    ("Electricity Board", "expense"),
    ("Internet Provider", "expense"),
    ("Petrol Pump", "expense"),
    ("Employer", "income"),
    ("Salary", "income"),
    ("Freelance Client", "income"),
    ("Consulting Client", "income"),
    ("Business", "income"),
    ("Rental Income", "income"),
    ("Investment", "income"),
    ("Dividend", "income"),
    ("Interest", "income"),
    ("Bonus", "income"),
    ("Commission", "income"),
    ("Scholarship", "income"),
    ("Stipend", "income"),
    ("Refund", "income"),
    ("Government Benefit", "income"),
    ("Other Income", "income"),
)


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    op.add_column("payees", sa.Column("type", sa.Text(), nullable=True), schema="public")

    # Infer type for existing rows from transaction history: income-only payees
    # become 'income'; everything else (expense-only, mixed, or unused) defaults
    # to 'expense', matching the more common case.
    op.execute(
        """
        UPDATE public.payees
        SET type = 'income'
        WHERE EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.payee_id = payees.id AND t.transaction_type = 'income'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.transactions t2
            WHERE t2.payee_id = payees.id AND t2.transaction_type = 'expense'
        )
        """
    )
    op.execute("UPDATE public.payees SET type = 'expense' WHERE type IS NULL")

    op.alter_column(
        "payees",
        "type",
        existing_type=sa.Text(),
        nullable=False,
        server_default=sa.text("'expense'"),
        schema="public",
    )
    op.create_check_constraint(
        "payees_type_check", "payees", "type IN ('expense', 'income')", schema="public"
    )
    op.drop_constraint("uq_payees_user_normalized_name", "payees", type_="unique", schema="public")
    op.create_unique_constraint(
        "uq_payees_user_normalized_name_type",
        "payees",
        ["user_id", "normalized_name", "type"],
        schema="public",
    )
    op.create_index("ix_payees_user_type", "payees", ["user_id", "type"], schema="public")

    # Backfill predefined categories/payees for profiles that already existed
    # before these lists were introduced/expanded. Additive only — a NOT EXISTS
    # guard skips anything the user already has (seeded, renamed, or self-made).
    category_values = ",\n            ".join(
        f"({_sql_literal(name)}, {_sql_literal(ctype)}, {_sql_literal(icon)}, {_sql_literal(color)})"
        for name, ctype, icon, color in DEFAULT_CATEGORIES
    )
    op.execute(
        f"""
        INSERT INTO public.categories (user_id, name, type, icon, color)
        SELECT p.id, v.name, v.type, v.icon, v.color
        FROM public.profiles p
        CROSS JOIN (VALUES
            {category_values}
        ) AS v(name, type, icon, color)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.categories c
            WHERE c.user_id = p.id AND lower(c.name) = lower(v.name) AND c.type = v.type
        )
        """
    )

    payee_values = ",\n            ".join(
        f"({_sql_literal(name)}, {_sql_literal(ptype)})" for name, ptype in PREDEFINED_PAYEES
    )
    op.execute(
        f"""
        INSERT INTO public.payees (user_id, name, normalized_name, type)
        SELECT p.id, v.name, lower(v.name), v.type
        FROM public.profiles p
        CROSS JOIN (VALUES
            {payee_values}
        ) AS v(name, type)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.payees pa
            WHERE pa.user_id = p.id AND pa.normalized_name = lower(v.name) AND pa.type = v.type
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_payees_user_type", table_name="payees", schema="public")
    op.drop_constraint("uq_payees_user_normalized_name_type", "payees", type_="unique", schema="public")
    op.create_unique_constraint(
        "uq_payees_user_normalized_name", "payees", ["user_id", "normalized_name"], schema="public"
    )
    op.drop_constraint("payees_type_check", "payees", type_="check", schema="public")
    op.drop_column("payees", "type", schema="public")
