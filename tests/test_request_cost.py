"""What a request costs the database: pooled connections held, and statements issued.

These guard the scaling work of 2026-10-04: a chat turn must not hold a pooled connection while the model
thinks, and the budget and dashboard reads must not grow with the user's data or repeat their sums.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ai_service.auth import CurrentUser, get_current_user
from ai_service.db.base import Base
import ai_service.models  # noqa: F401
from ai_service.db.session import get_async_session
from ai_service.main import app
from ai_service.repositories import CategoryRepository, PayeeRepository, TransactionRepository
from ai_service.services import agent_service
from ai_service.services.budget_service import BudgetService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from tests.factories import count_statements

R = 100  # one rupee in minor units


async def test_a_chat_turn_holds_no_pooled_connection_while_the_model_thinks(tmp_path, monkeypatch):
    """Two chats, a pool of two, and a model that takes 1.2 s per call. If a chat kept its connection through
    those waits, an unrelated request would starve until the pool timeout (before the fix: a TimeoutError)."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'pool.db'}", pool_size=2, max_overflow=0, pool_timeout=0.4)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id = uuid.uuid4()
    async with factory() as setup:
        await ProfileService(setup).create_profile(user_id)

    class SlowModel(BaseChatModel):
        """Asks for the dashboard tool, then answers; every call takes 1.2 s."""

        @property
        def _llm_type(self) -> str:
            return "slow-test-model"

        def bind_tools(self, tools, **kwargs):
            return self

        def _generate(self, messages, stop=None, run_manager=None, **kwargs):
            raise NotImplementedError

        async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
            await asyncio.sleep(1.2)
            if isinstance(messages[-1], ToolMessage):
                reply = AIMessage(content="All good.")
            else:
                reply = AIMessage(content="", tool_calls=[{"name": "get_dashboard", "args": {}, "id": "call-1"}])
            return ChatResult(generations=[ChatGeneration(message=reply)])

    async def one_session():
        async with factory() as session:
            yield session

    async def the_user():
        return CurrentUser(id=user_id, role="authenticated")

    monkeypatch.setattr(agent_service, "_agent", None)  # build the real agent graph and tools, around the slow model
    monkeypatch.setattr(agent_service, "ChatOpenAI", lambda **kwargs: SlowModel(callbacks=kwargs.get("callbacks")))
    monkeypatch.setitem(app.dependency_overrides, get_async_session, one_session)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, the_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", timeout=30) as client:
        loop = asyncio.get_running_loop()
        started = loop.time()
        chats = [asyncio.create_task(client.post("/api/v1/chat", json={"message": "How am I doing?"})) for _ in range(2)]
        for at in (0.5, 1.8):  # inside the first model call, then inside the second (after the tool's read)
            await asyncio.sleep(max(0.0, started + at - loop.time()))
            assert (await client.get("/api/v1/dashboard")).status_code == 200
        replies = await asyncio.gather(*chats)

    assert [reply.status_code for reply in replies] == [200, 200]
    assert {reply.json()["response"] for reply in replies} == {"All good."}
    assert all([call["tool_name"] for call in reply.json()["tool_calls"]] == ["get_dashboard"] for reply in replies)
    await engine.dispose()


@pytest.mark.asyncio
async def test_month_view_names_every_carried_category_with_one_query(engine, session):
    async def statements_for(carried: int) -> int:
        user_id = uuid.uuid4()
        await ProfileService(session).create_profile(user_id)
        categories = [c for c in await CategoryRepository(session).list(user_id) if c.type == "expense"][:carried]
        for category in categories:  # budgeted in September and not in October: October shows them as carried in
            await BudgetService(session).set_budget(
                user_id, category_id=category.id, month=9, year=2026, budgeted_amount=500 * R
            )
        with count_statements(engine) as statements:
            view = await BudgetService(session).month_view(user_id, 10, 2026)
        assert [row["category"] for row in view["carried"]] == sorted(c.name for c in categories)
        return len(statements)

    assert await statements_for(1) == await statements_for(6)


@pytest.mark.asyncio
async def test_balances_at_several_dates_come_from_one_statement(engine, session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    categories = CategoryRepository(session)
    food = (await categories.find_by_name(user_id, "Food", "expense")).id
    salary = (await categories.find_by_name(user_id, "Salary", "income")).id
    ledger = TransactionService(session)
    await ledger.add_transaction(user_id, amount=1000 * R, transaction_type="starting_balance", transaction_date=date(2026, 8, 31))
    await ledger.add_transaction(user_id, category_id=salary, amount=5000 * R, transaction_type="income", transaction_date=date(2026, 9, 1))
    await ledger.add_transaction(user_id, category_id=food, amount=700 * R, transaction_type="expense", transaction_date=date(2026, 9, 15))
    await ledger.add_transaction(user_id, category_id=food, amount=300 * R, transaction_type="expense", transaction_date=date(2026, 10, 1))

    transactions = TransactionRepository(session)
    cutoffs = [date(2026, 9, 1), date(2026, 10, 1), None]  # "before" leaves out the day itself; None is everything
    with count_statements(engine) as statements:
        balances = await transactions.get_balances(user_id, cutoffs)

    assert balances == [1000 * R, 5300 * R, 5000 * R]
    assert len(statements) == 1
    assert balances == [await transactions.get_balance(user_id, before=cutoff) for cutoff in cutoffs]


@pytest.mark.asyncio
async def test_dashboard_reads_the_database_in_ten_statements_or_fewer(api_client, engine, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    food = (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id
    await BudgetService(session).set_budget(user_id, category_id=food, month=10, year=2026, budgeted_amount=9000 * R)
    await TransactionService(session).add_transaction(
        user_id, category_id=food, amount=250 * R, transaction_type="expense", transaction_date=date(2026, 10, 3)
    )

    session.expunge_all()  # a request starts with an empty session, as in production
    with count_statements(engine) as statements:
        response = await client.get("/api/v1/dashboard", params={"today": "2026-10-22"})

    assert response.status_code == 200
    assert response.json()["total_spent"] == 250 * R
    # 13 before 2026-10-04 (three balance sums, the month's expenses summed twice), then 10: the budgets' categories
    # had a SELECT of their own, and the month's expenses were summed again after the month view had them by category.
    assert len(statements) <= 8


@pytest.mark.asyncio
async def test_a_transactions_page_reads_its_categories_and_payees_with_its_rows(api_client, engine, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    food = (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id
    payee = (await PayeeRepository(session).list(user_id, type="expense"))[0]
    payee_name = payee.name
    for day in (1, 2, 3):
        await TransactionService(session).add_transaction(
            user_id, category_id=food, payee_id=payee.id, amount=100 * R, transaction_type="expense",
            transaction_date=date(2026, 10, day),
        )

    session.expunge_all()  # a request starts with an empty session, as in production
    with count_statements(engine) as statements:
        response = await client.get("/api/v1/transactions", params={"limit": 20})

    assert response.status_code == 200
    assert {(row["category"], row["payee"]) for row in response.json()["transactions"]} == {("Food", payee_name)}
    assert len(statements) == 2  # the page, with its categories and payees joined in, and the total
