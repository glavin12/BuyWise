from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.base_context import ContextLoader
from ai_service.context.models import ContextModule


class TimeLoader(ContextLoader):
    async def load(self, user_id: uuid.UUID, session: AsyncSession) -> ContextModule:
        now = datetime.now(timezone.utc)
        return ContextModule(
            name="current_time",
            content=f"Current date: {now.strftime('%Y-%m-%d')} (UTC)",
        )
