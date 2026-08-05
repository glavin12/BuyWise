from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Profile


class ProfileRepository:
    """Database access for user profiles. Scoped by ``id`` (= auth user id)."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: uuid.UUID) -> Profile | None:
        return await self.session.scalar(
            select(Profile).where(Profile.id == user_id)
        )

    async def create(self, user_id: uuid.UUID, **fields) -> Profile:
        profile = Profile(id=user_id, **fields)
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def update(
        self,
        user_id: uuid.UUID,
        **fields,
    ) -> Profile | None:
        """Apply a partial update; returns ``None`` if no profile exists."""
        result = await self.session.execute(
            update(Profile).where(Profile.id == user_id).values(**fields)
        )
        if not result.rowcount:
            return None
        return await self.get(user_id)

    async def get_or_create(self, user_id: uuid.UUID) -> Profile:
        profile = await self.get(user_id)
        if profile is None:
            profile = await self.create(user_id)
        return profile
