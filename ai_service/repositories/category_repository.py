from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Category


class CategoryRepository:
    """Database access for transaction categories.

    Categories are shared reference data (``is_system``) plus user-created
    entries; both are readable by any authenticated user.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[Category]:
        result = await self.session.scalars(
            select(Category).order_by(Category.type, Category.name)
        )
        return list(result)

    async def get(self, category_id: uuid.UUID) -> Category | None:
        return await self.session.scalar(
            select(Category).where(Category.id == category_id)
        )

    async def find_by_name(self, name: str, type: str) -> Category | None:
        """Case-insensitive lookup for a category name within a type."""
        return await self.session.scalar(
            select(Category).where(
                func.lower(Category.name) == name.strip().lower(),
                Category.type == type,
            )
        )
