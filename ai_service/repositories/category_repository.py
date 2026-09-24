from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Category


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
    # finer-grained expense categories (personal-finance staples)
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


class CategoryRepository:
    """User-scoped access to transaction categories."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, user_id: uuid.UUID, *, active_only: bool = True) -> list[Category]:
        stmt = select(Category).where(Category.user_id == user_id)
        if active_only:
            stmt = stmt.where(Category.is_active.is_(True))
        result = await self.session.scalars(stmt.order_by(Category.type, Category.name))
        return list(result)

    async def get(self, user_id: uuid.UUID, category_id: uuid.UUID) -> Category | None:
        return await self.session.scalar(
            select(Category).where(Category.id == category_id, Category.user_id == user_id)
        )

    async def find_by_name(self, user_id: uuid.UUID, name: str, type: str) -> Category | None:
        return await self.session.scalar(
            select(Category).where(
                Category.user_id == user_id,
                Category.is_active.is_(True),
                func.lower(Category.name) == name.strip().lower(),
                Category.type == type,
            )
        )

    async def create(
        self,
        user_id: uuid.UUID,
        *,
        name: str,
        type: str,
        icon: str | None = None,
        color: str | None = None,
    ) -> Category:
        category = Category(
            user_id=user_id,
            name=name.strip(),
            type=type,
            icon=icon,
            color=color,
        )
        self.session.add(category)
        await self.session.flush()
        return category

    async def update(self, user_id: uuid.UUID, category_id: uuid.UUID, **fields) -> Category | None:
        category = await self.get(user_id, category_id)
        if category is None:
            return None
        for field, value in fields.items():
            if value is not None and field == "name":
                value = value.strip()
            setattr(category, field, value)
        await self.session.flush()
        # The UPDATE's server-side onupdate expires updated_at; reload it here
        # because a lazy load later, in async code, raises MissingGreenlet (a 500).
        await self.session.refresh(category)
        return category

    async def delete(self, user_id: uuid.UUID, category_id: uuid.UUID) -> bool:
        category = await self.get(user_id, category_id)
        if category is None:
            return False
        category.is_active = False
        await self.session.flush()
        return True

    async def seed_defaults(self, user_id: uuid.UUID) -> list[Category]:
        existing = await self.list(user_id, active_only=False)
        existing_keys = {(item.name.lower(), item.type) for item in existing}
        created: list[Category] = []
        for name, category_type, icon, color in DEFAULT_CATEGORIES:
            if (name.lower(), category_type) in existing_keys:
                continue
            created.append(
                await self.create(
                    user_id,
                    name=name,
                    type=category_type,
                    icon=icon,
                    color=color,
                )
            )
        return created
