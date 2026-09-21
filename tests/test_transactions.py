from __future__ import annotations

from datetime import date, datetime, timezone
import uuid

import pytest

from ai_service.repositories import CategoryRepository, TransactionRepository
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService


@pytest.mark.asyncio
async def test_same_day_transactions_sort_by_creation_time_not_random_id(session):
    """Regression: two transactions dated the same day must tie-break on
    created_at, not on id (a random UUID unrelated to entry order) — otherwise
    the list looks shuffled whenever a user logs more than one thing per day,
    and is not stabilized against transaction_date drifting from timezone
    changes between entries."""
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    shared_date = date(2026, 1, 1)
    repo = TransactionRepository(session)
    earlier = await repo.create(
        user_id,
        category_id=category.id,
        amount=100,
        transaction_type="expense",
        transaction_date=shared_date,
        created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    later = await repo.create(
        user_id,
        category_id=category.id,
        amount=200,
        transaction_type="expense",
        transaction_date=shared_date,
        created_at=datetime(2026, 1, 1, 18, 0, 0, tzinfo=timezone.utc),
    )
    await session.commit()

    rows = await repo.list(user_id)

    assert [row.id for row in rows] == [later.id, earlier.id]


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
