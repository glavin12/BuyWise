from __future__ import annotations

import pytest
import uuid

from ai_service.repositories import CategoryRepository
from ai_service.services.profile_service import ProfileService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_profile_creation_seeds_user_owned_categories_and_cash(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    rows = await CategoryRepository(session).list(user_id)
    assert len(rows) == 20
    assert {row.user_id for row in rows} == {user_id}
