from __future__ import annotations

import pytest

from ai_service.repositories import PayeeRepository
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_payee_find_or_create_normalizes_names(session):
    user_id = (await create_profile(session)).id
    repository = PayeeRepository(session)
    first = await repository.find_or_create(user_id, "  Local Cafe ")
    second = await repository.find_or_create(user_id, "local cafe")
    assert first.id == second.id
    assert first.normalized_name == "local cafe"
