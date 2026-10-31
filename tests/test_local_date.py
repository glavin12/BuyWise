"""The AI path works out "today" in the user's timezone, not the server's UTC date.

Every case freezes the clock at 2026-10-31T20:00Z: that is 2026-11-01 01:30 in Asia/Kolkata, so a
user there is already in November while a UTC server is still on 31 October.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from langchain_core.messages import AIMessage

import ai_service.core.context as core_context
import ai_service.services.chat_service as chat_service
from ai_service.context import ContextManager
from ai_service.core.context import request_context
from ai_service.core.rate_limit import limiter
from ai_service.services.profile_service import ProfileService
from ai_service.tools.dashboard import get_dashboard
from ai_service.tools.plans import get_budget_status, set_category_budget
from ai_service.tools.spending import get_income_summary, get_spending_breakdown
from ai_service.tools.transactions import add_transaction, get_recent_transactions
from tests.factories import count_statements

FROZEN_NOW = datetime(2026, 10, 31, 20, 0, tzinfo=timezone.utc)

KOLKATA = {"timezone": "Asia/Kolkata", "date": "2026-11-01", "month": "November", "number": 11, "left": 29}
UTC = {"timezone": "UTC", "date": "2026-10-31", "month": "October", "number": 10, "left": 0}


@pytest.fixture(autouse=True)
def _frozen_clock(monkeypatch):
    monkeypatch.setattr(core_context, "_utc_now", lambda: FROZEN_NOW)
    monkeypatch.setattr(limiter, "enabled", False)


async def _turn(client, monkeypatch) -> dict:
    """Send one chat message whose "agent" calls the real tools; returns the context and the results."""
    seen: dict = {}

    async def agent(messages):
        seen["context"] = messages[0].content
        seen["saved"] = await add_transaction.ainvoke({"amount": 100, "category": "Food"})
        seen["dashboard"] = await get_dashboard.ainvoke({})
        seen["budget_set"] = await set_category_budget.ainvoke({"category": "Food", "budgeted_amount": 5000})
        seen["budget_status"] = await get_budget_status.ainvoke({})
        seen["spending"] = await get_spending_breakdown.ainvoke({})
        seen["income"] = await get_income_summary.ainvoke({})
        seen["recent_this_month"] = await get_recent_transactions.ainvoke({"period": "this_month"})
        seen["recent_last_month"] = await get_recent_transactions.ainvoke({"period": "last_month"})
        return {"messages": [*messages, AIMessage(content="done")]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)
    response = await client.post("/api/v1/chat", json={"message": "log 100 for lunch"})
    assert response.status_code == 200
    assert "encountered an error" not in response.json()["response"]
    return seen


async def _user(api_client, session, **profile):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id, **profile)
    return client


@pytest.mark.parametrize("local", [KOLKATA, UTC], ids=["kolkata", "utc"])
async def test_an_expense_without_a_date_is_dated_in_the_users_timezone(api_client, session, monkeypatch, local):
    client = await _user(api_client, session, timezone=local["timezone"])
    seen = await _turn(client, monkeypatch)
    assert seen["saved"]["transaction_date"] == local["date"]


@pytest.mark.parametrize("local", [KOLKATA, UTC], ids=["kolkata", "utc"])
async def test_this_month_is_the_users_month_in_every_tool(api_client, session, monkeypatch, local):
    client = await _user(api_client, session, timezone=local["timezone"])
    seen = await _turn(client, monkeypatch)

    assert (seen["dashboard"]["month"], seen["dashboard"]["year"]) == (local["month"], 2026)
    assert seen["dashboard"]["days_remaining_in_month"] == local["left"]
    assert seen["budget_status"]["month"] == local["month"]
    assert seen["spending"]["month"] == local["month"]
    assert seen["income"]["month"] == local["month"]
    # The expense dated today is this month's, whichever month that is, and not last month's.
    assert seen["dashboard"]["display_total_spent"] == 100.0
    assert seen["spending"]["display_total_spent"] == 100.0
    assert seen["recent_this_month"]["count"] == 1
    assert seen["recent_last_month"]["count"] == 0


async def test_the_daily_average_divides_by_the_users_day_of_the_month(api_client, session, monkeypatch):
    client = await _user(api_client, session, timezone="Asia/Kolkata")
    seen = await _turn(client, monkeypatch)
    assert seen["spending"]["daily_average"] == 100.0  # 100 spent over 1 day, not over 31


@pytest.mark.parametrize("local", [KOLKATA, UTC], ids=["kolkata", "utc"])
async def test_a_budget_without_month_and_year_is_for_the_users_month(api_client, session, monkeypatch, local):
    client = await _user(api_client, session, timezone=local["timezone"])
    seen = await _turn(client, monkeypatch)
    assert (seen["budget_set"]["month"], seen["budget_set"]["year"]) == (local["number"], 2026)


@pytest.mark.parametrize("local", [KOLKATA, UTC], ids=["kolkata", "utc"])
async def test_the_context_message_names_the_users_date_and_timezone(api_client, session, monkeypatch, local):
    client = await _user(api_client, session, timezone=local["timezone"])
    seen = await _turn(client, monkeypatch)
    assert f"Current date: {local['date']} ({local['timezone']})" in seen["context"]


async def test_an_unknown_timezone_falls_back_to_kolkata(api_client, session, monkeypatch):
    client = await _user(api_client, session, timezone="Mars/Olympus")  # the service does not validate it
    seen = await _turn(client, monkeypatch)
    assert f"Current date: {KOLKATA['date']} (Asia/Kolkata)" in seen["context"]
    assert seen["saved"]["transaction_date"] == KOLKATA["date"]
    assert seen["dashboard"]["month"] == KOLKATA["month"]


async def test_a_user_without_a_profile_gets_the_default_timezone(api_client, monkeypatch):
    client, _ = api_client
    seen: dict = {}

    async def agent(messages):
        seen["context"] = messages[0].content
        seen["dashboard"] = await get_dashboard.ainvoke({})
        return {"messages": [*messages, AIMessage(content="done")]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)
    await client.post("/api/v1/chat", json={"message": "hi"})

    assert f"Current date: {KOLKATA['date']} (Asia/Kolkata)" in seen["context"]
    assert seen["dashboard"]["month"] == KOLKATA["month"]


async def test_outside_a_chat_turn_today_is_the_utc_date(session):
    assert core_context.get_today() == date(2026, 10, 31)
    with request_context(uuid.uuid4(), session):  # a turn that was given no date
        assert core_context.get_today() == date(2026, 10, 31)
    with request_context(uuid.uuid4(), session, today=date(2026, 11, 1)):
        assert core_context.get_today() == date(2026, 11, 1)
    assert core_context.get_today() == date(2026, 10, 31)


async def test_building_the_context_reads_the_profile_once(engine, session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    await session.commit()

    with count_statements(engine) as statements:
        await ContextManager(session).build_context(user_id, uuid.uuid4())

    assert len([sql for sql in statements if "FROM profiles" in sql]) == 1
