from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.base_context import ContextLoader
from ai_service.context.models import ContextModule
from ai_service.core.context import local_date
from ai_service.models import Profile


class TimeLoader(ContextLoader):
    """Today's date where the user is: "today" and "this month" mean theirs, not the server's UTC."""

    async def load(
        self, user_id: uuid.UUID, session: AsyncSession, profile: Profile | None
    ) -> ContextModule:
        zone, today = local_date(profile.timezone if profile else None)
        return ContextModule(
            name="current_time",
            content=f"Current date: {today.isoformat()} ({zone})",
            today=today,
        )
