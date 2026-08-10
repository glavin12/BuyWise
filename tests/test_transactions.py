from __future__ import annotations

import uuid

import pytest

from ai_service.repositories import CategoryRepository
from ai_service.services.account_service import AccountService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_transaction_crud_is_user_scoped(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    account = (await AccountService(session).list_accounts(user_id))[0]
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)
    created = await service.add_transaction(
        user_id,
        account_id=uuid.UUID(account["id"]),
        category_id=category.id,
        amount=1250,
        transaction_type="expense",
    )
    updated = await service.update_transaction(
        user_id, uuid.UUID(created["id"]), notes="Lunch"
    )
    assert updated["amount"] == 1250
    assert updated["notes"] == "Lunch"
    assert await service.delete_transaction(user_id, uuid.UUID(created["id"]))
