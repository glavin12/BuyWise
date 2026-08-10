from __future__ import annotations

import uuid

import pytest

from ai_service.repositories import CategoryRepository
from ai_service.services.account_service import AccountNotFoundError, AccountService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_user_cannot_read_another_users_account_or_category(session):
    user_a = (await create_profile(session)).id
    user_b = (await create_profile(session)).id
    await session.commit()
    await CategoryRepository(session).seed_defaults(user_a)
    await CategoryRepository(session).seed_defaults(user_b)
    categories = CategoryRepository(session)
    category = await categories.find_by_name(user_a, "Food", "expense")
    assert category is not None
    assert await categories.get(user_b, category.id) is None
    account = await AccountService(session).create_account(
        user_a, name="Private", account_type="cash"
    )
    with pytest.raises(AccountNotFoundError):
        await AccountService(session).get_account(user_b, uuid.UUID(account["id"]))
