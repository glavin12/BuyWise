from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.base_context import ContextLoader
from ai_service.context.models import ContextModule
from ai_service.services.profile_service import ProfileService


class ProfileLoader(ContextLoader):
    async def load(self, user_id: uuid.UUID, session: AsyncSession) -> ContextModule:
        svc = ProfileService(session)
        profile = await svc.get_profile(user_id)
        if profile is None:
            return ContextModule(
                name="profile",
                content="New user — profile not yet configured.",
            )
        parts = []
        if profile.full_name:
            parts.append(f"User: {profile.full_name}")
        parts.append(f"Currency: {profile.currency}")
        parts.append(f"Timezone: {profile.timezone}")
        if profile.income_type:
            income = f"Income: {profile.income_type}"
            if profile.salary_day:
                income += f" (salary day: {profile.salary_day})"
            parts.append(income)
        if profile.savings_target_percent is not None:
            parts.append(f"Savings target: {profile.savings_target_percent}%")
        return ContextModule(name="profile", content=" | ".join(parts))
