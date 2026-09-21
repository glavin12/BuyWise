from __future__ import annotations

from datetime import date

import pytest
import uuid

from ai_service.core.context import request_context
from ai_service.repositories import CategoryRepository
from ai_service.services.budget_service import BudgetService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from ai_service.tools.categories import get_categories
from ai_service.tools.dashboard import get_dashboard
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_ai_tools_use_user_scoped_context(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    with request_context(user_id, session):
        categories = await get_categories.ainvoke({})
        dashboard = await get_dashboard.ainvoke({})
    assert categories["count"] == 36
    assert dashboard["currency"] == "INR"


@pytest.mark.asyncio
async def test_get_dashboard_flags_budgets_that_exceed_income(session):
    """Regression: assigning more across categories than income covers must be
    visible to the agent even when total_spent is still low (Ready to Assign
    going negative in the budget UI)."""
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    categories = CategoryRepository(session)
    salary = await categories.find_by_name(user_id, "Salary", "income")
    food = await categories.find_by_name(user_id, "Food", "expense")
    personal_care = await categories.find_by_name(user_id, "Personal Care", "expense")

    await TransactionService(session).add_transaction(
        user_id, category_id=salary.id, amount=453400, transaction_type="income"
    )
    today = date.today()
    budgets = BudgetService(session)
    await budgets.set_budget(
        user_id, category_id=food.id, month=today.month, year=today.year, budgeted_amount=400000
    )
    await budgets.set_budget(
        user_id,
        category_id=personal_care.id,
        month=today.month,
        year=today.year,
        budgeted_amount=300000,
    )

    with request_context(user_id, session):
        dashboard = await get_dashboard.ainvoke({})

    assert dashboard["unassigned"] == -246600
    assert dashboard["display_unassigned"] == -2466.0
