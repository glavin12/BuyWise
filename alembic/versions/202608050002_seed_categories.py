"""seed default categories

Revision ID: 202608050002
Revises: 202608050001
Create Date: 2026-08-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202608050002"
down_revision: Union[str, None] = "202608050001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

categories_table = sa.table(
    "categories",
    sa.column("name", sa.Text),
    sa.column("type", sa.Text),
    sa.column("icon", sa.Text),
    sa.column("color", sa.Text),
    sa.column("is_system", sa.Boolean),
)

DEFAULT_CATEGORIES = [
    # (name, type, icon, color)
    ("Food & Dining", "expense", "utensils", "#ef4444"),
    ("Groceries", "expense", "shopping-cart", "#f97316"),
    ("Transport", "expense", "car", "#3b82f6"),
    ("Shopping", "expense", "bag", "#a855f7"),
    ("Utilities", "expense", "zap", "#eab308"),
    ("Entertainment", "expense", "film", "#ec4899"),
    ("Health", "expense", "heart-pulse", "#14b8a6"),
    ("Education", "expense", "book-open", "#8b5cf6"),
    ("Travel", "expense", "plane", "#06b6d4"),
    ("Rent", "expense", "home", "#64748b"),
    ("Investments", "expense", "trending-up", "#22c55e"),
    ("Subscriptions", "expense", "repeat", "#f43f5e"),
    ("Other", "expense", "ellipsis", "#94a3b8"),
    ("Salary", "income", "briefcase", "#22c55e"),
    ("Freelance", "income", "laptop", "#0ea5e9"),
    ("Business", "income", "building", "#f59e0b"),
    ("Investment Income", "income", "trending-up", "#10b981"),
    ("Gifts", "income", "gift", "#ec4899"),
    ("Refunds", "income", "rotate-ccw", "#84cc16"),
    ("Other Income", "income", "ellipsis", "#94a3b8"),
]


def upgrade() -> None:
    op.bulk_insert(
        categories_table,
        [
            {"name": name, "type": type, "icon": icon, "color": color, "is_system": True}
            for name, type, icon, color in DEFAULT_CATEGORIES
        ],
    )


def downgrade() -> None:
    op.execute(
        "delete from public.categories where is_system = true "
        "and type in ('expense', 'income')"
    )
