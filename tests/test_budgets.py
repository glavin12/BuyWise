from __future__ import annotations

from datetime import date
import uuid

import pytest

from ai_service.repositories import CategoryRepository
from ai_service.services.budget_service import BudgetService
from ai_service.services.profile_service import ProfileService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_budget_status_calculates_spent_and_remaining(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    budget = await BudgetService(session).set_budget(
        user_id,
        category_id=category.id,
        month=date.today().month,
        year=date.today().year,
        budgeted_amount=10000,
    )
    assert budget["budgeted_amount"] == 10000
    assert (await BudgetService(session).budget_status(user_id))["total_budgeted"] == 10000
