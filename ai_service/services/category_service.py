from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import CategoryRepository


class CategoryNotFoundError(LookupError):
    pass


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.categories = CategoryRepository(session)

    async def list_categories(self, user_id: uuid.UUID, *, type: str | None = None) -> dict:
        rows = await self.categories.list(user_id)
        if type is not None:
            rows = [category for category in rows if category.type == type]
        return {"count": len(rows), "categories": [self._to_dict(category) for category in rows]}

    async def get_category(self, user_id: uuid.UUID, category_id: uuid.UUID) -> dict:
        category = await self.categories.get(user_id, category_id)
        if category is None:
            raise CategoryNotFoundError("Category not found")
        return self._to_dict(category)

    async def create_category(self, user_id: uuid.UUID, **fields) -> dict:
        self._validate(fields)
        category = await self.categories.create(user_id, **fields)
        await self.session.commit()
        return self._to_dict(category)

    async def update_category(self, user_id: uuid.UUID, category_id: uuid.UUID, **fields) -> dict:
        self._validate(fields, partial=True)
        category = await self.categories.update(user_id, category_id, **fields)
        if category is None:
            raise CategoryNotFoundError("Category not found")
        await self.session.commit()
        return self._to_dict(category)

    async def delete_category(self, user_id: uuid.UUID, category_id: uuid.UUID) -> bool:
        deleted = await self.categories.delete(user_id, category_id)
        if not deleted:
            raise CategoryNotFoundError("Category not found")
        await self.session.commit()
        return True

    async def seed_default_categories(self, user_id: uuid.UUID):
        return await self.categories.seed_defaults(user_id)

    @staticmethod
    def _validate(fields: dict, partial: bool = False) -> None:
        for field, value in fields.items():
            if field == "name":
                if value is None or not value.strip():
                    raise ValueError("name is required" if not partial else "name cannot be empty")
            elif field == "type" and (value is None or value not in {"expense", "income"}):
                raise ValueError("type must be expense or income")
        if not partial:
            if "name" not in fields:
                raise ValueError("name is required")
            if "type" not in fields:
                raise ValueError("type must be expense or income")

    @staticmethod
    def _to_dict(category) -> dict:
        return {
            "id": str(category.id),
            "name": category.name,
            "type": category.type,
            "icon": category.icon,
            "color": category.color,
            "is_active": category.is_active,
            "created_at": category.created_at.isoformat() if category.created_at else None,
            "updated_at": category.updated_at.isoformat() if category.updated_at else None,
        }
