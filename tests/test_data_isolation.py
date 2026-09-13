from __future__ import annotations

import pytest

from ai_service.repositories import CategoryRepository
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_user_cannot_read_another_users_category(session):
    user_a = (await create_profile(session)).id
    user_b = (await create_profile(session)).id
    await session.commit()
    await CategoryRepository(session).seed_defaults(user_a)
    await CategoryRepository(session).seed_defaults(user_b)
    categories = CategoryRepository(session)
    category = await categories.find_by_name(user_a, "Food", "expense")
    assert category is not None
    assert await categories.get(user_b, category.id) is None
