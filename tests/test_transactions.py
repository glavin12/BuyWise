from __future__ import annotations

from datetime import date, datetime, timezone
import uuid

import pytest

from ai_service.repositories import CategoryRepository, TransactionRepository, PayeeRepository
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import PayeeReferenceError, TransactionService


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


@pytest.mark.asyncio
async def test_add_transaction_creates_payee_with_matching_type(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Salary", "income")
    service = TransactionService(session)
    created = await service.add_transaction(
        user_id,
        category_id=category.id,
        amount=50000,
        transaction_type="income",
        payee_name="New Client",
    )
    assert created["payee"] == "New Client"
    payee = await PayeeRepository(session).get(user_id, uuid.UUID(created["payee_id"]))
    assert payee.type == "income"


@pytest.mark.asyncio
async def test_add_transaction_rejects_payee_type_mismatch(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Salary", "income")
    expense_payee = await PayeeRepository(session).find_or_create(user_id, "Grocer", "expense")
    service = TransactionService(session)
    with pytest.raises(PayeeReferenceError):
        await service.add_transaction(
            user_id,
            category_id=category.id,
            payee_id=expense_payee.id,
            amount=100,
            transaction_type="income",
        )


async def _add(service, user_id, category, **extra):
    return await service.add_transaction(user_id, category_id=category.id, amount=1250, transaction_type="expense", **extra)


@pytest.mark.asyncio
async def test_repeating_an_idempotency_key_returns_the_first_transaction(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)

    first = await _add(service, user_id, category, idempotency_key="retry-1")
    again = await _add(service, user_id, category, idempotency_key="retry-1")

    assert again["id"] == first["id"]
    assert (await service.list_transactions(user_id))["total"] == 1
    # The session survives the conflict: the next write works.
    await _add(service, user_id, category, idempotency_key="retry-2")
    assert (await service.list_transactions(user_id))["total"] == 2


@pytest.mark.asyncio
async def test_the_same_idempotency_key_is_separate_for_each_user(session):
    service = TransactionService(session)
    ids = []
    for _ in range(2):
        user_id = uuid.uuid4()
        await ProfileService(session).create_profile(user_id)
        category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
        created = await _add(service, user_id, category, idempotency_key="shared-key")
        assert (await service.list_transactions(user_id))["total"] == 1
        ids.append(created["id"])
    assert ids[0] != ids[1]


@pytest.mark.asyncio
async def test_transactions_without_a_key_are_never_merged(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)

    first = await _add(service, user_id, category)
    second = await _add(service, user_id, category)

    assert first["id"] != second["id"]
    assert (await service.list_transactions(user_id))["total"] == 2


@pytest.mark.asyncio
async def test_post_transactions_is_idempotent_and_ignores_a_blank_key(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    body = {"category_id": str(category.id), "amount": 1250, "transaction_type": "expense"}

    first = await client.post("/api/v1/transactions", json={**body, "idempotency_key": "tap-1"})
    again = await client.post("/api/v1/transactions", json={**body, "idempotency_key": "tap-1"})
    assert first.status_code == again.status_code == 200
    assert again.json()["id"] == first.json()["id"]

    # A blank key means "no key": two of those are two transactions.
    blank_a = await client.post("/api/v1/transactions", json={**body, "idempotency_key": "  "})
    blank_b = await client.post("/api/v1/transactions", json={**body, "idempotency_key": ""})
    assert blank_a.json()["id"] != blank_b.json()["id"]

    listed = (await client.get("/api/v1/transactions")).json()
    assert listed["total"] == 3
    assert (await client.post("/api/v1/transactions", json={**body, "idempotency_key": "x" * 129})).status_code == 422
