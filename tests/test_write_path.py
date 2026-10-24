"""The write path: what a create, edit or delete costs the database, and what the edit schemas accept.

Every test here runs on SQLite, and again on PostgreSQL when TEST_POSTGRES_URL is set (see tests/postgres.py).
Each request gets its own session and a pre-pinging pool, as in production, so "checkouts" counts the times a
request took a connection from the pool: each one costs a ping, a BEGIN and a reset on the real network.
"""

from __future__ import annotations

import asyncio
import uuid
from contextlib import contextmanager
from dataclasses import dataclass

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.context import request_context
from ai_service.core.rate_limit import limiter
from ai_service.db.base import Base
import ai_service.models  # noqa: F401
from ai_service.db.session import get_async_session
from ai_service.main import app
from ai_service.models import Transaction
from ai_service.repositories import CategoryRepository, PayeeRepository
from ai_service.services.goal_service import GoalService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from ai_service.tools.goals import add_goal, update_goal_progress
from ai_service.tools.plans import set_category_budget
from ai_service.tools.transactions import add_transaction
from ai_service.utils.financial import MAX_MINOR_AMOUNT, amount_to_minor
from tests.factories import count_statements
from tests.postgres import postgres_url


@dataclass
class Cost:
    statements: list[str]
    checkouts: list[int]


@contextmanager
def request_cost(engine):
    """The statements a request runs and the connections it checks out of the pool."""
    checkouts: list[int] = []

    def checked_out(dbapi_connection, record, proxy):
        checkouts.append(1)

    event.listen(engine.sync_engine, "checkout", checked_out)
    try:
        with count_statements(engine) as statements:
            yield Cost(statements, checkouts)
    finally:
        event.remove(engine.sync_engine, "checkout", checked_out)


@dataclass
class Ledger:
    backend: str
    client: AsyncClient
    engine: object
    factory: object
    user_id: uuid.UUID
    food: uuid.UUID  # expense categories
    shopping: uuid.UUID
    salary: uuid.UUID  # an income category
    payee: uuid.UUID  # an expense payee
    payee_name: str
    income_payee: uuid.UUID

    async def create(self, **fields) -> dict:
        body = {"category_id": str(self.food), "amount": 12500, "transaction_type": "expense", **fields}
        response = await self.client.post("/api/v1/transactions", json=body)
        assert response.status_code == 200, response.text
        return response.json()

    async def rows(self) -> int:
        async with self.factory() as session:
            return await session.scalar(select(func.count()).select_from(Transaction))


@pytest_asyncio.fixture(params=["sqlite", "postgres"])
async def ledger(request, tmp_path, monkeypatch):
    if request.param == "postgres":
        url, options = postgres_url(), {}
    else:
        url, options = f"sqlite+aiosqlite:///{tmp_path / 'write.db'}", {"pool_size": 2, "max_overflow": 0}
    engine = create_async_engine(url, pool_pre_ping=True, **options)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id = uuid.uuid4()
    async with factory() as setup:
        await ProfileService(setup).create_profile(user_id)
        categories, payees = CategoryRepository(setup), PayeeRepository(setup)
        food = await categories.find_by_name(user_id, "Food", "expense")
        shopping = await categories.find_by_name(user_id, "Shopping", "expense")
        salary = await categories.find_by_name(user_id, "Salary", "income")
        payee = (await payees.list(user_id, type="expense"))[0]
        income_payee = (await payees.list(user_id, type="income"))[0]
        found = (food.id, shopping.id, salary.id, payee.id, payee.name, income_payee.id)

    async def one_session():  # a session per request, as get_async_session does
        async with factory() as session:
            yield session

    async def the_user():
        return CurrentUser(id=user_id, role="authenticated")

    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setitem(app.dependency_overrides, get_async_session, one_session)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, the_user)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield Ledger(request.param, client, engine, factory, user_id, *found)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── Round trips per write ────────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("key", [None, "retry-1"])
async def test_creating_a_transaction_uses_one_connection_and_three_statements(ledger, key):
    body = {"category_id": str(ledger.food), "amount": 12500, "transaction_type": "expense", "payment_method": "upi"}
    if key:
        body["idempotency_key"] = key

    with request_cost(ledger.engine) as cost:
        response = await ledger.client.post("/api/v1/transactions", json=body)

    assert response.status_code == 200
    created = response.json()
    assert (created["category"], created["category_icon"], created["payee"]) == ("Food", "food", None)
    assert (created["amount"], created["display_amount"], created["currency"]) == (12500, 125.0, "INR")
    assert (created["payment_method"], created["cleared_status"], created["parent_transaction_id"]) == ("upi", "pending", None)
    assert created["created_at"] and created["updated_at"] and created["transaction_date"]
    # The category, the profile's currency, the INSERT. Before: 7 statements and 2 checkouts, because the
    # insert ran in a savepoint, was refreshed, committed, and then read back on a second connection.
    assert len(cost.statements) == 3
    assert len(cost.checkouts) == 1
    # What was saved is what was answered.
    assert (await ledger.client.get(f"/api/v1/transactions/{created['id']}")).json() == created


async def test_a_created_transaction_names_its_payee_on_one_connection(ledger):
    with request_cost(ledger.engine) as cost:
        by_id = await ledger.client.post(
            "/api/v1/transactions",
            json={"category_id": str(ledger.food), "payee_id": str(ledger.payee), "amount": 100, "transaction_type": "expense",
                  "idempotency_key": "with-payee"},
        )
    assert by_id.status_code == 200 and by_id.json()["payee"] == ledger.payee_name
    assert len(cost.statements) == 4  # the same three and the payee's lookup
    assert len(cost.checkouts) == 1

    with request_cost(ledger.engine) as cost:
        by_name = await ledger.client.post(
            "/api/v1/transactions",
            json={"category_id": str(ledger.food), "payee_name": "Corner Shop", "amount": 100, "transaction_type": "expense"},
        )
    assert by_name.status_code == 200 and by_name.json()["payee"] == "Corner Shop"
    assert len(cost.checkouts) == 1
    assert (await ledger.client.get(f"/api/v1/transactions/{by_name.json()['id']}")).json() == by_name.json()


async def test_a_replayed_key_returns_the_first_transaction_on_one_connection(ledger):
    first = await ledger.create(idempotency_key="retry-1")

    with request_cost(ledger.engine) as cost:
        replay = await ledger.client.post(
            "/api/v1/transactions",
            json={"category_id": str(ledger.food), "amount": 99900, "transaction_type": "expense", "idempotency_key": "retry-1"},
        )

    assert replay.status_code == 200
    assert replay.json() == first  # the first row as it was saved, not the retry's body
    assert await ledger.rows() == 1
    assert len(cost.statements) == 4  # the three of a create, whose INSERT finds the key taken, and the first row
    assert len(cost.checkouts) == 1


async def test_requests_racing_with_one_key_save_one_transaction(ledger):
    if ledger.backend != "postgres":
        pytest.skip("needs concurrent connections: SQLite serializes writers")

    body = {"category_id": str(ledger.food), "amount": 12500, "transaction_type": "expense", "idempotency_key": "race"}
    responses = await asyncio.gather(*[ledger.client.post("/api/v1/transactions", json=body) for _ in range(6)])

    assert [response.status_code for response in responses] == [200] * 6
    assert len({response.json()["id"] for response in responses}) == 1
    assert await ledger.rows() == 1


async def test_two_users_may_use_the_same_key(ledger):
    first = await ledger.create(idempotency_key="shared")
    other = uuid.uuid4()
    async with ledger.factory() as session:
        await ProfileService(session).create_profile(other)
        food = (await CategoryRepository(session).find_by_name(other, "Food", "expense")).id
    async with ledger.factory() as session:
        saved = await TransactionService(session).add_transaction(
            other, category_id=food, amount=500, transaction_type="expense", idempotency_key="shared"
        )
    assert saved["id"] != first["id"]
    assert await ledger.rows() == 2


async def test_patching_a_transaction_loads_each_row_once(ledger):
    created = await ledger.create(payee_id=str(ledger.payee))
    url = f"/api/v1/transactions/{created['id']}"

    with request_cost(ledger.engine) as cost:
        patched = await ledger.client.patch(url, json={"category_id": str(ledger.shopping)})
    assert patched.status_code == 200
    assert (patched.json()["category"], patched.json()["category_icon"]) == ("Shopping", "shopping")
    assert patched.json()["category_id"] == str(ledger.shopping)
    assert patched.json()["payee"] == ledger.payee_name
    # The transaction, the new category, the UPDATE, and the updated_at the UPDATE leaves for the database to
    # fill in. Before: 7 statements (the category and payee were fetched twice, the transaction three times).
    assert len(cost.statements) == 4
    assert len(cost.checkouts) == 1
    assert (await ledger.client.get(url)).json() == patched.json()

    with request_cost(ledger.engine) as cost:
        noted = await ledger.client.patch(url, json={"notes": "Lunch"})
    assert noted.json()["notes"] == "Lunch" and noted.json()["category"] == "Shopping"
    assert len(cost.statements) == 3  # was 5
    assert len(cost.checkouts) == 1

    with request_cost(ledger.engine) as cost:
        cleared = await ledger.client.patch(url, json={"payee_id": None, "description": "x"})
    assert cleared.json()["payee"] is None and cleared.json()["payee_id"] is None
    assert len(cost.statements) == 3  # clearing the payee needs no lookup
    assert (await ledger.client.get(url)).json() == cleared.json()


async def test_patching_the_payee_names_the_new_one(ledger):
    created = await ledger.create()
    url = f"/api/v1/transactions/{created['id']}"

    with request_cost(ledger.engine) as cost:
        patched = await ledger.client.patch(url, json={"payee_id": str(ledger.payee)})

    assert patched.json()["payee"] == ledger.payee_name
    assert len(cost.statements) == 4 and len(cost.checkouts) == 1
    assert (await ledger.client.get(url)).json() == patched.json()


async def test_a_patch_that_changes_nothing_still_answers_in_full(ledger):
    created = await ledger.create(notes="same")
    patched = await ledger.client.patch(f"/api/v1/transactions/{created['id']}", json={"notes": "same"})
    assert patched.status_code == 200
    assert patched.json() == created


async def test_deleting_a_transaction_uses_one_connection(ledger):
    created = await ledger.create()
    with request_cost(ledger.engine) as cost:
        response = await ledger.client.delete(f"/api/v1/transactions/{created['id']}")
    assert response.json() == {"status": "deleted", "transaction_id": created["id"]}
    assert len(cost.checkouts) == 1
    assert await ledger.rows() == 0
    assert (await ledger.client.delete(f"/api/v1/transactions/{created['id']}")).status_code == 404


# ── The checks the edit keeps ────────────────────────────────────────────────────────────────────────────────


async def test_patch_still_checks_the_category_and_payee_against_the_transaction_type(ledger):
    created = await ledger.create(payee_id=str(ledger.payee))
    url = f"/api/v1/transactions/{created['id']}"

    async def patch(**fields):
        response = await ledger.client.patch(url, json=fields)
        return response.status_code, response.json().get("detail")

    assert await patch(category_id=str(ledger.salary)) == (400, "Category type does not match transaction type")
    assert await patch(transaction_type="income") == (400, "Category type does not match transaction type")
    assert await patch(payee_id=str(ledger.income_payee)) == (400, "Payee type does not match transaction type")
    assert await patch(category_id=str(uuid.uuid4())) == (400, "Category not found")
    assert await patch(payee_id=str(uuid.uuid4())) == (400, "Payee not found")
    assert await patch(category_id=None) == (400, "A category is required for expense and income transactions")
    async with ledger.factory() as session:  # an archived category cannot be moved to
        await CategoryRepository(session).delete(ledger.user_id, ledger.shopping)
        await session.commit()
    assert await patch(category_id=str(ledger.shopping)) == (400, "Category not found")
    # Moving to a starting balance clears the category, and then there is nothing to match.
    status, _ = await patch(transaction_type="starting_balance", category_id=None, payee_id=None)
    assert status == 200
    assert (await ledger.client.get(url)).json()["transaction_type"] == "starting_balance"
    assert (await ledger.client.patch(f"/api/v1/transactions/{uuid.uuid4()}", json={"notes": "x"})).status_code == 404


async def test_an_unrelated_edit_is_not_blocked_by_a_row_that_predates_the_type_rules(ledger):
    created = await ledger.create(payee_id=str(ledger.payee))
    async with ledger.factory() as session:  # a legacy row: an expense that points at an income payee
        await session.execute(
            update(Transaction).where(Transaction.id == uuid.UUID(created["id"])).values(payee_id=ledger.income_payee)
        )
        await session.commit()

    response = await ledger.client.patch(f"/api/v1/transactions/{created['id']}", json={"notes": "still editable"})

    assert response.status_code == 200
    assert response.json()["notes"] == "still editable"


# ── An explicit null on a required field ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("field", ["amount", "currency", "transaction_type", "transaction_date", "cleared_status"])
async def test_patching_a_required_transaction_field_to_null_is_a_422(ledger, field):
    created = await ledger.create()
    response = await ledger.client.patch(f"/api/v1/transactions/{created['id']}", json={field: None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]
    assert (await ledger.client.get(f"/api/v1/transactions/{created['id']}")).json() == created


async def test_patching_an_optional_transaction_field_to_null_clears_it(ledger):
    created = await ledger.create(
        payee_id=str(ledger.payee), payment_method="cash", description="d", notes="n"
    )
    cleared = await ledger.client.patch(
        f"/api/v1/transactions/{created['id']}",
        json={"payee_id": None, "payment_method": None, "description": None, "notes": None},
    )
    assert cleared.status_code == 200
    body = cleared.json()
    assert (body["payee_id"], body["payee"], body["payment_method"], body["description"], body["notes"]) == (None,) * 5
    assert body["amount"] == 12500 and body["category"] == "Food"  # what was not sent is untouched


async def _goal(ledger, **extra) -> dict:
    response = await ledger.client.post(
        "/api/v1/goals",
        json={"title": "Trip", "target_amount": 100000, "current_amount": 1000, **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("field", ["title", "target_amount", "current_amount", "status"])
async def test_patching_a_required_goal_field_to_null_is_a_422(ledger, field):
    goal = await _goal(ledger)
    response = await ledger.client.patch(f"/api/v1/goals/{goal['id']}", json={field: None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]


async def test_patching_an_optional_goal_field_to_null_clears_it(ledger):
    goal = await _goal(
        ledger, category_id=str(ledger.food), description="d", goal_type="vacation", priority="high", target_date="2031-01-01"
    )
    assert goal["category"] == "Food"
    cleared = await ledger.client.patch(
        f"/api/v1/goals/{goal['id']}",
        json={"category_id": None, "description": None, "goal_type": None, "priority": None, "target_date": None},
    )
    assert cleared.status_code == 200
    body = cleared.json()
    assert [body[key] for key in ("category_id", "category", "description", "goal_type", "priority", "target_date")] == [None] * 6
    assert body["title"] == "Trip" and body["target_amount"] == 100000


async def test_patching_a_categorys_name_to_null_is_a_422_and_its_icon_may_be_cleared(ledger):
    url = f"/api/v1/categories/{ledger.food}"
    response = await ledger.client.patch(url, json={"name": None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "name"]
    cleared = await ledger.client.patch(url, json={"icon": None, "color": None})
    assert cleared.status_code == 200
    assert (cleared.json()["name"], cleared.json()["icon"], cleared.json()["color"]) == ("Food", None, None)


@pytest.mark.parametrize("field", ["currency", "timezone", "onboarding_complete", "budget_alerts"])
async def test_setting_a_required_profile_field_to_null_is_a_422(ledger, field):
    response = await ledger.client.post("/api/v1/profile", json={field: None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]


async def test_setting_an_optional_profile_field_to_null_clears_it(ledger):
    assert (await ledger.client.post("/api/v1/profile", json={"salary_day": 5, "full_name": "Asha"})).status_code == 200
    cleared = await ledger.client.post(
        "/api/v1/profile",
        json={"salary_day": None, "full_name": None, "income_type": None, "savings_target_percent": None, "investment_style": None},
    )
    assert cleared.status_code == 200
    assert (cleared.json()["salary_day"], cleared.json()["full_name"]) == (None, None)
    assert cleared.json()["currency"] == "INR"


# ── The amount cap ───────────────────────────────────────────────────────────────────────────────────────────


async def test_the_largest_amount_is_saved_and_one_more_is_a_422(ledger):
    largest = await ledger.create(amount=MAX_MINOR_AMOUNT)
    assert largest["amount"] == MAX_MINOR_AMOUNT
    assert (await ledger.client.get(f"/api/v1/transactions/{largest['id']}")).json()["amount"] == MAX_MINOR_AMOUNT

    too_big = MAX_MINOR_AMOUNT + 1
    url = f"/api/v1/transactions/{largest['id']}"
    requests = [
        ("POST", "/api/v1/transactions", {"category_id": str(ledger.food), "amount": too_big, "transaction_type": "expense"}),
        ("POST", "/api/v1/transactions", {"category_id": str(ledger.food), "amount": 10**19, "transaction_type": "expense"}),
        ("PATCH", url, {"amount": too_big}),
        ("PATCH", url, {"amount": 10**19}),
        ("POST", "/api/v1/budgets", {"category_id": str(ledger.food), "month": 10, "year": 2026, "budgeted_amount": too_big}),
        ("PATCH", f"/api/v1/budgets/{uuid.uuid4()}", {"budgeted_amount": 10**19}),
        ("POST", "/api/v1/goals", {"title": "g", "target_amount": too_big}),
        ("POST", "/api/v1/goals", {"title": "g", "target_amount": 100, "current_amount": too_big}),
    ]
    goal = await _goal(ledger)
    requests += [
        ("PATCH", f"/api/v1/goals/{goal['id']}", {"target_amount": 10**19}),
        ("PATCH", f"/api/v1/goals/{goal['id']}", {"current_amount": too_big}),
    ]
    for method, path, body in requests:
        response = await ledger.client.request(method, path, json=body)
        assert response.status_code == 422, (method, path, body, response.text)

    budget = await ledger.client.post(
        "/api/v1/budgets", json={"category_id": str(ledger.food), "month": 10, "year": 2026, "budgeted_amount": MAX_MINOR_AMOUNT}
    )
    assert budget.status_code == 200 and budget.json()["budgeted_amount"] == MAX_MINOR_AMOUNT
    assert (await _goal(ledger, target_amount=MAX_MINOR_AMOUNT, current_amount=MAX_MINOR_AMOUNT))["status"] == "completed"


@pytest.mark.parametrize("value", [10**13, 9999999999999.99, "10000000000000", 0, "0.01"])
def test_amount_to_minor_accepts_up_to_the_cap(value):
    assert 0 <= amount_to_minor(value) <= MAX_MINOR_AMOUNT


@pytest.mark.parametrize("value", [10**13 + 0.01, "10000000000000.01", 1e30, "1e1000000", 10**30, float("inf"), float("nan"), -1, "abc"])
def test_amount_to_minor_rejects_amounts_the_database_cannot_hold(value):
    with pytest.raises(ValueError):
        amount_to_minor(value)


@pytest.mark.parametrize("amount", [MAX_MINOR_AMOUNT + 1, 10**19, -1, True, 1.5, "5"])
async def test_the_service_rejects_an_amount_it_cannot_store(session, amount):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    food = (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id
    with pytest.raises(ValueError):
        await TransactionService(session).add_transaction(user_id, category_id=food, amount=amount, transaction_type="expense")
    saved = await TransactionService(session).add_transaction(
        user_id, category_id=food, amount=MAX_MINOR_AMOUNT, transaction_type="expense"
    )
    with pytest.raises(ValueError):
        await TransactionService(session).update_transaction(user_id, uuid.UUID(saved["id"]), amount=amount)


async def test_the_ai_tools_refuse_an_amount_above_the_cap(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    goal = await GoalService(session).add_goal(user_id, title="Trip", target_amount=100000)

    with request_context(user_id, session):
        replies = [
            await add_transaction.ainvoke({"amount": 1e30, "category": "Food"}),
            await add_goal.ainvoke({"title": "Moon", "target_amount": 1e30}),
            await update_goal_progress.ainvoke({"goal_id": goal["id"], "current_amount": 1e30}),
            await set_category_budget.ainvoke({"category": "Food", "budgeted_amount": 1e30}),
        ]

    assert [reply["status"] for reply in replies] == ["error"] * 4
    assert {reply["message"] for reply in replies} == {"amount is too large"}


# ── A goal's category in the answer to its edit ──────────────────────────────────────────────────────────────


async def test_patching_a_goals_category_answers_with_the_new_category(ledger):
    goal = await _goal(ledger)
    assert goal["category"] is None
    url = f"/api/v1/goals/{goal['id']}"

    with request_cost(ledger.engine) as cost:
        food = await ledger.client.patch(url, json={"category_id": str(ledger.food)})
    assert (food.json()["category_id"], food.json()["category"]) == (str(ledger.food), "Food")
    assert len(cost.statements) == 3  # the category, the goal, the UPDATE
    assert len(cost.checkouts) == 1

    shopping = await ledger.client.patch(url, json={"category_id": str(ledger.shopping)})
    assert (shopping.json()["category_id"], shopping.json()["category"]) == (str(ledger.shopping), "Shopping")

    cleared = await ledger.client.patch(url, json={"category_id": None})
    assert (cleared.json()["category_id"], cleared.json()["category"]) == (None, None)

    again = await ledger.client.patch(url, json={"category_id": str(ledger.shopping), "current_amount": 5000})
    assert again.json()["category"] == "Shopping" and again.json()["current_amount"] == 5000
    listed = (await ledger.client.get("/api/v1/goals")).json()["goals"]
    assert [goal for goal in listed if goal["id"] == again.json()["id"]] == [again.json()]
    assert (await ledger.client.patch(url, json={"category_id": str(uuid.uuid4())})).status_code == 400
