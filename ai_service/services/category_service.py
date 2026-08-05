from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import CategoryRepository


class CategoryService:
    """Business logic for transaction categories (shared reference data)."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.categories = CategoryRepository(session)

    async def list_categories(self, *, type: str | None = None) -> dict:
        """Tool-facing list of known categories for the model to reference."""
        rows = await self.categories.list_all()
        if type is not None:
            rows = [c for c in rows if c.type == type]
        return {
            "count": len(rows),
            "categories": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "type": c.type,
                    "icon": c.icon,
                    "color": c.color,
                    "is_system": c.is_system,
                }
                for c in rows
            ],
        }
