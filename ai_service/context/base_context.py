from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.models import ContextModule


class ContextLoader(ABC):
    @abstractmethod
    async def load(self, user_id: uuid.UUID, session: AsyncSession) -> ContextModule:
        ...
