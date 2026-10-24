from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.models import ContextModule
from ai_service.models import Profile


class ContextLoader(ABC):
    @abstractmethod
    async def load(
        self, user_id: uuid.UUID, session: AsyncSession, profile: Profile | None
    ) -> ContextModule:
        """``profile`` is the user's profile, read once by the manager (``None``: not onboarded)."""
        ...
