from __future__ import annotations

import uuid

import pytest

from ai_service.repositories import CategoryRepository
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_transaction_crud_is_user_scoped(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)
    created = await service.add_transaction(
        user_id,
        category_id=category.id,
        amount=1250,
        transaction_type="expense",
        payment_method="upi",
    )
    updated = await service.update_transaction(
        user_id, uuid.UUID(created["id"]), notes="Lunch"
    )
    assert created["payment_method"] == "upi"
    assert updated["amount"] == 1250
    assert updated["notes"] == "Lunch"
    assert await service.delete_transaction(user_id, uuid.UUID(created["id"]))
