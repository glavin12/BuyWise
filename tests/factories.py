from __future__ import annotations

import uuid

from ai_service.models import Profile


async def create_profile(session, user_id: uuid.UUID | None = None) -> Profile:
    profile = Profile(id=user_id or uuid.uuid4())
    session.add(profile)
    await session.flush()
    return profile
