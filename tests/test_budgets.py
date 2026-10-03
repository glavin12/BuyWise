from __future__ import annotations

from datetime import date
import uuid

import pytest

from ai_service.repositories import CategoryRepository, TransactionRepository
from ai_service.services.budget_service import BudgetService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from tests.factories import create_profile

R = 100  # one rupee in minor units


async def _user_with_categories(session, *names: str):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    categories = CategoryRepository(session)
    ids = {name: (await categories.find_by_name(user_id, name, "expense")).id for name in names}
    salary = (await categories.find_by_name(user_id, "Salary", "income")).id
    return user_id, ids, salary


async def _income(session, user_id, salary_id, rupees: int, on: date):
    await TransactionService(session).add_transaction(
        user_id, category_id=salary_id, amount=rupees * R, transaction_type="income", transaction_date=on
    )


async def _spend(session, user_id, category_id, rupees: int, on: date):
    await TransactionService(session).add_transaction(
        user_id, category_id=category_id, amount=rupees * R, transaction_type="expense", transaction_date=on
    )


async def _assign(session, user_id, category_id, rupees: int, month: int, year: int = 2026):
    await BudgetService(session).set_budget(
        user_id, category_id=category_id, month=month, year=year, budgeted_amount=rupees * R
    )


def _by_name(rows):
    return {row["category"]: row for row in rows}


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


@pytest.mark.asyncio
async def test_budget_status_follows_the_callers_date(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    await BudgetService(session).set_budget(user_id, category_id=category.id, month=1, year=2026, budgeted_amount=7000)

    service = BudgetService(session)
    assert (await service.budget_status(user_id, today=date(2026, 1, 20)))["total_budgeted"] == 7000
    assert (await service.budget_status(user_id, period="last_month", today=date(2026, 2, 1)))["total_budgeted"] == 7000
    assert (await service.budget_status(user_id, today=date(2026, 2, 1)))["total_budgeted"] == 0


@pytest.mark.asyncio
async def test_envelopes_roll_over_leftovers_and_overspending(session):
    """The worked example: August leaves Food +1,000 and Entertainment -500, and September starts from them."""
    user_id, ids, salary = await _user_with_categories(session, "Food", "Entertainment", "Rent")
    service = BudgetService(session)

    await _income(session, user_id, salary, 20000, date(2026, 8, 1))
    for name, rupees in (("Food", 8000), ("Entertainment", 3000), ("Rent", 9000)):
        await _assign(session, user_id, ids[name], rupees, month=8)
    await _spend(session, user_id, ids["Food"], 7000, date(2026, 8, 10))
    await _spend(session, user_id, ids["Entertainment"], 3500, date(2026, 8, 15))

    august = await service.month_view(user_id, 8, 2026)
    rows = _by_name(august["budgets"])
    assert (rows["Food"]["carried_in"], rows["Food"]["available"]) == (0, 1000 * R)
    assert rows["Entertainment"]["available"] == -500 * R
    assert rows["Rent"]["available"] == 9000 * R
    assert (august["opening_balance"], august["closing_balance"]) == (0, 9500 * R)
    assert august["unassigned"] == 0  # 9,500 in the bank = 1,000 - 500 + 9,000 in envelopes

    await _income(session, user_id, salary, 20000, date(2026, 9, 1))
    for name, rupees in (("Food", 8000), ("Entertainment", 3000), ("Rent", 9000)):
        await _assign(session, user_id, ids[name], rupees, month=9)
    await _spend(session, user_id, ids["Food"], 7500, date(2026, 9, 12))
    await _spend(session, user_id, ids["Entertainment"], 2000, date(2026, 9, 20))

    september = await service.month_view(user_id, 9, 2026)
    rows = _by_name(september["budgets"])
    assert (rows["Food"]["carried_in"], rows["Food"]["available"]) == (1000 * R, 1500 * R)
    # the overspend is not forgotten on the 1st: it is paid off by this month's budget
    assert (rows["Entertainment"]["carried_in"], rows["Entertainment"]["available"]) == (-500 * R, 500 * R)
    assert (rows["Rent"]["carried_in"], rows["Rent"]["available"]) == (9000 * R, 18000 * R)
    # this month's own figures are unchanged by the carry-over
    assert rows["Entertainment"]["remaining"] == 1000 * R
    assert september["carried"] == []

    # one continuous balance: a month closes where the next one opens, and nothing resets
    assert (september["opening_balance"], september["closing_balance"]) == (august["closing_balance"], 20000 * R)
    assert await TransactionRepository(session).get_balance(user_id) == september["closing_balance"]
    # all income was assigned and nothing was spent outside an envelope, so nothing is left to assign
    assert september["unassigned"] == 0

    # a month nobody touched still shows what is carried, and the balance does not move
    october = await service.month_view(user_id, 10, 2026)
    assert october["budgets"] == []
    assert {row["category"]: row["available"] for row in october["carried"]} == {
        "Food": 1500 * R,
        "Entertainment": 500 * R,
        "Rent": 18000 * R,
    }
    assert (october["opening_balance"], october["closing_balance"], october["unassigned"]) == (20000 * R, 20000 * R, 0)


@pytest.mark.asyncio
async def test_carried_row_shows_a_category_with_no_entry_this_month(session):
    user_id, ids, salary = await _user_with_categories(session, "Food", "Rent")
    await _income(session, user_id, salary, 10000, date(2026, 8, 1))
    await _assign(session, user_id, ids["Food"], 1000, month=8)
    await _assign(session, user_id, ids["Rent"], 5000, month=8)
    await _spend(session, user_id, ids["Food"], 400, date(2026, 8, 5))
    await _spend(session, user_id, ids["Rent"], 5000, date(2026, 8, 6))  # exactly used up: nothing carries
    await _spend(session, user_id, ids["Food"], 100, date(2026, 9, 3))

    september = await BudgetService(session).month_view(user_id, 9, 2026)
    assert september["budgets"] == []
    carried = _by_name(september["carried"])
    assert list(carried) == ["Food"]  # Rent: nothing carried and nothing spent, so no row
    assert (carried["Food"]["carried_in"], carried["Food"]["spent"], carried["Food"]["available"]) == (600 * R, 100 * R, 500 * R)
    # 10,000 - 400 - 5,000 - 100 = 4,500 in the bank; 500 sits in Food, so 4,000 is unassigned
    assert (september["closing_balance"], september["unassigned"]) == (4500 * R, 4000 * R)


@pytest.mark.asyncio
async def test_spending_before_a_category_was_budgeted_is_not_debt(session):
    user_id, ids, salary = await _user_with_categories(session, "Food")
    await _income(session, user_id, salary, 10000, date(2026, 7, 1))
    await _spend(session, user_id, ids["Food"], 5000, date(2026, 7, 10))  # no budget yet
    await _assign(session, user_id, ids["Food"], 1000, month=8)

    august = (await BudgetService(session).month_view(user_id, 8, 2026))["budgets"][0]
    assert (august["carried_in"], august["available"]) == (0, 1000 * R)
    september = (await BudgetService(session).month_view(user_id, 9, 2026))["carried"][0]
    assert september["carried_in"] == 1000 * R  # the July spending never touched the envelope


@pytest.mark.asyncio
async def test_month_budgets_route_returns_the_rollover_figures(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    food = (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id
    salary = (await CategoryRepository(session).find_by_name(user_id, "Salary", "income")).id
    await _income(session, user_id, salary, 5000, date(2026, 8, 1))
    await _assign(session, user_id, food, 2000, month=8)
    await _spend(session, user_id, food, 2500, date(2026, 8, 9))

    body = (await client.get("/api/v1/budgets/2026-09")).json()
    assert body["budgets"] == []
    assert body["carried"][0]["category"] == "Food"
    assert body["carried"][0]["available"] == -500 * R
    assert (body["opening_balance"], body["closing_balance"], body["unassigned"]) == (2500 * R, 2500 * R, 3000 * R)
    assert (await client.get("/api/v1/budgets/2026-13")).status_code == 400
