from __future__ import annotations

import pytest

from ai_service.repositories import PayeeRepository
from ai_service.services.payee_service import PayeeService
from ai_service.services.profile_service import ProfileService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_payee_find_or_create_normalizes_names(session):
    user_id = (await create_profile(session)).id
    repository = PayeeRepository(session)
    first = await repository.find_or_create(user_id, "  Local Cafe ", "expense")
    second = await repository.find_or_create(user_id, "local cafe", "expense")
    assert first.id == second.id
    assert first.normalized_name == "local cafe"


@pytest.mark.asyncio
async def test_find_or_create_keeps_expense_and_income_payees_separate(session):
    user_id = (await create_profile(session)).id
    repository = PayeeRepository(session)
    expense_payee = await repository.find_or_create(user_id, "Acme", "expense")
    income_payee = await repository.find_or_create(user_id, "Acme", "income")
    assert expense_payee.id != income_payee.id
    assert expense_payee.type == "expense"
    assert income_payee.type == "income"


@pytest.mark.asyncio
async def test_list_payees_filters_by_type(session):
    user_id = (await create_profile(session)).id
    await ProfileService(session).payees.seed_defaults(user_id)
    result = await PayeeService(session).list_payees(user_id, type="income")
    assert len(result) > 0
    assert all(p["type"] == "income" for p in result)


@pytest.mark.asyncio
async def test_create_payee_is_idempotent_on_duplicate_name(session):
    user_id = (await create_profile(session)).id
    service = PayeeService(session)
    first = await service.create_payee(user_id, "Local Cafe", "expense")
    second = await service.create_payee(user_id, "local cafe", "expense")
    assert first["id"] == second["id"]
