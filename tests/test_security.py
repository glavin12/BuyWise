"""Regression tests for the Stage 1 backend security hardening (S1-S13, B1-B2).

S2 (revoking Supabase Data API grants in migration 003) cannot run on SQLite; it
is verified against Supabase with
``select has_table_privilege('authenticated', 'public.<table>', 'INSERT')``.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.requests import Request

import ai_service.auth.dependencies as auth_dependencies
import ai_service.db.session as db_session
import ai_service.services.agent_service as agent_service
import ai_service.services.chat_service as chat_service
from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import Settings
from ai_service.core.context import request_context
from ai_service.core.rate_limit import _get_rate_limit_key, limiter
from ai_service.main import app
from ai_service.models import Category, Conversation, Message, MessageRole, Profile
from ai_service.repositories import CategoryRepository, PayeeRepository, TransactionRepository
from ai_service.repositories.messages import MessageCreate, MessageRepository
from ai_service.services.goal_service import GoalService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from ai_service.tools.calculator import calculator
from ai_service.tools.goals import add_goal

REPO_ROOT = Path(__file__).resolve().parents[1]
CONFLICT = {"detail": "This conflicts with an existing record."}


@pytest.fixture(autouse=True)
def _no_rate_limit(monkeypatch):
    """These tests fire many requests from one client key; throttling is not under test."""
    monkeypatch.setattr(limiter, "enabled", False)


async def _profile(api_client, session, **fields):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id, **fields)
    return client, user_id


def _fake_agent(monkeypatch, reply="done", seen=None):
    """Replace the LLM with a canned reply; returns the call log."""
    calls: list[list] = []

    async def agent(messages):
        calls.append([m.content for m in messages])
        return {"messages": [*messages, AIMessage(content=reply)]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)
    return calls


# --- S1: calculator is not an eval() -------------------------------------------------


def _calc(expression: str) -> dict:
    return calculator.invoke({"expression": expression})


def test_calculator_still_does_plain_math():
    assert _calc("1500 + 2300") == {"expression": "1500 + 2300", "result": 3800.0, "status": "success"}
    assert _calc("75000 * 0.2")["result"] == 15000
    assert _calc("(2 + 3) * -4 // 3 % 5 ** 2")["status"] == "success"


@pytest.mark.parametrize(
    "expression",
    [
        "().__class__",
        "().__class__.__base__.__subclasses__()",
        # Yields a plain number through eval()'s sandbox escape, so the old tool
        # reported success; proves attribute traversal is no longer evaluated.
        "().__class__.__base__.__subclasses__().__len__()",
        "__import__('os').system('echo pwned')",
        "abs(-1)",
        "True + 1",
        "'a' * 3",
        "1 if 1 else 2",
        "10 ** 16",  # over the 1e15 value cap
        "2 ** 101",  # over the exponent cap
        "(-8) ** 0.5",  # would be complex
        "1 / 0",
        "9" * 201,  # over the length cap
    ],
)
def test_calculator_rejects_anything_but_bounded_arithmetic(expression):
    result = _calc(expression)
    assert result["status"] == "error"
    assert "result" not in result


def test_calculator_does_not_hang_on_a_power_tower():
    started = time.perf_counter()
    result = _calc("9**9**9**9")
    assert result["status"] == "error"
    assert time.perf_counter() - started < 1


# --- S3: fail closed outside development ---------------------------------------------


def test_environment_defaults_to_production(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.ENVIRONMENT == "production"
    assert not settings.is_development


def test_docs_and_dev_token_are_absent_when_environment_is_unset(tmp_path):
    """Boot the real app the way a deploy that forgot ENVIRONMENT would (fresh
    process, no .env in cwd) and probe it."""
    probe = """
import asyncio, json
from httpx import ASGITransport, AsyncClient
from ai_service.main import app

async def main():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        out = {p: (await c.get(p)).status_code for p in ("/docs", "/redoc", "/openapi.json", "/health/live")}
        out["dev_token"] = (await c.post("/api/v1/dev/token", json={"email": "a@b.c", "password": "x"})).status_code
    print(json.dumps(out))

asyncio.run(main())
"""
    env = {k: v for k, v in os.environ.items() if k != "ENVIRONMENT"}
    env["PYTHONPATH"] = str(REPO_ROOT)
    proc = subprocess.run(
        [sys.executable, "-c", probe], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=120
    )
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout.strip().splitlines()[-1]) == {
        "/docs": 404,
        "/redoc": 404,
        "/openapi.json": 404,
        "/health/live": 200,
        "dev_token": 404,
    }


# --- S4: the throttle key cannot be spoofed ------------------------------------------


def _key(headers: list[tuple[bytes, bytes]]) -> str:
    return _get_rate_limit_key(Request({"type": "http", "headers": headers, "client": ("9.9.9.9", 1)}))


def test_rate_limit_key_ignores_x_user_id():
    bearer = [(b"authorization", b"Bearer some-token")]
    assert _key(bearer) == _key(bearer + [(b"x-user-id", b"attacker-1")])
    assert _key(bearer) == _key(bearer + [(b"x-user-id", b"attacker-2")])
    assert _key([(b"x-user-id", b"a")]) == _key([(b"x-user-id", b"b")]) == "ip:9.9.9.9"


# --- S5: chat idempotency ------------------------------------------------------------


async def test_retry_while_first_send_is_running_gets_409_and_agent_runs_once(
    api_client, session, monkeypatch
):
    client, _ = await _profile(api_client, session)
    body = {"message": "log lunch 250", "idempotency_key": "k-inflight"}
    retries: list = []
    calls = 0

    async def agent(messages):
        nonlocal calls
        calls += 1
        retries.append(await client.post("/api/v1/chat", json=body))  # arrives mid-flight
        return {"messages": [*messages, AIMessage(content="logged")]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)

    first = await client.post("/api/v1/chat", json=body)

    assert first.status_code == 200 and first.json()["response"] == "logged"
    assert retries[0].status_code == 409
    assert retries[0].json() == {"detail": "Still processing this message"}
    assert calls == 1
    # Once finished, the same key replays the stored answer without another agent run.
    replay = await client.post("/api/v1/chat", json=body)
    assert replay.status_code == 200 and replay.json()["response"] == "logged"
    assert calls == 1


async def test_two_users_can_use_the_same_idempotency_key(api_client, session, monkeypatch):
    client, _ = await _profile(api_client, session)
    other_user = uuid.uuid4()
    await ProfileService(session).create_profile(other_user)
    calls = _fake_agent(monkeypatch)
    body = {"message": "hi", "idempotency_key": "shared-key"}

    mine = await client.post("/api/v1/chat", json=body)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=other_user, role="authenticated"
    )
    theirs = await client.post("/api/v1/chat", json=body)

    assert mine.status_code == theirs.status_code == 200
    assert mine.json()["conversation_id"] != theirs.json()["conversation_id"]
    assert len(calls) == 2


async def test_idempotency_key_is_unique_per_user_not_globally(session):
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    for user in (user_a, user_b):
        await ProfileService(session).create_profile(user)
    repo = MessageRepository(session)

    def message(user_id, key):
        return MessageCreate(
            conversation_id=uuid.uuid4(),
            user_id=user_id,
            role=MessageRole.USER,
            content="hi",
            idempotency_key=key,
        )

    first, created_first = await repo.create(message(user_a, "k"))
    duplicate, created_duplicate = await repo.create(message(user_a, "k"))
    other_user, created_other = await repo.create(message(user_b, "k"))

    assert (created_first, created_duplicate, created_other) == (True, False, True)
    assert duplicate.id == first.id != other_user.id


async def test_failed_send_can_be_retried_with_the_same_key(api_client, session, monkeypatch):
    client, user_id = await _profile(api_client, session)
    outcomes = iter([RuntimeError("llm down"), "recovered"])
    seen: list[list] = []

    async def agent(messages):
        seen.append([m.content for m in messages])
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return {"messages": [*messages, AIMessage(content=outcome)]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)
    body = {"message": "hello", "idempotency_key": "k-retry"}  # no conversation_id, twice

    failed = await client.post("/api/v1/chat", json=body)
    retried = await client.post("/api/v1/chat", json=body)
    replayed = await client.post("/api/v1/chat", json=body)

    assert "encountered an error" in failed.json()["response"]
    assert retried.status_code == 200 and retried.json()["response"] == "recovered"
    assert retried.json()["conversation_id"] == failed.json()["conversation_id"]
    assert "hello" in seen[1]  # the retry ran against the original message
    assert replayed.json()["response"] == "recovered" and len(seen) == 2
    conversations = await session.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.user_id == user_id)
    )
    assert conversations == 1


# --- S6: bounded AI cost -------------------------------------------------------------


async def test_chat_rejects_oversized_input(api_client, session, monkeypatch):
    client, _ = await _profile(api_client, session)
    calls = _fake_agent(monkeypatch)

    too_long = await client.post("/api/v1/chat", json={"message": "x" * 4001})
    long_key = await client.post("/api/v1/chat", json={"message": "hi", "idempotency_key": "k" * 129})
    at_limit = await client.post(
        "/api/v1/chat", json={"message": "x" * 4000, "idempotency_key": "k" * 128}
    )

    assert too_long.status_code == 422
    assert long_key.status_code == 422
    assert at_limit.status_code == 200
    assert len(calls) == 1


def test_llm_client_has_timeout_retry_and_token_caps(monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(agent_service, "_agent", None)
    monkeypatch.setattr(agent_service, "ChatGroq", lambda **kwargs: captured.update(kwargs) or object())
    monkeypatch.setattr(agent_service, "create_react_agent", lambda **kwargs: object())

    agent_service._get_agent()

    assert (captured["timeout"], captured["max_retries"], captured["max_tokens"]) == (45, 1, 4096)


async def test_agent_run_has_a_step_limit_and_a_deadline(monkeypatch):
    seen: dict = {}

    class Hangs:
        async def ainvoke(self, state, config=None):
            seen["config"] = config
            await asyncio.sleep(5)

    monkeypatch.setattr(agent_service, "_get_agent", lambda: Hangs())
    monkeypatch.setattr(agent_service, "AGENT_TIMEOUT_SECONDS", 0.05)

    with pytest.raises(asyncio.TimeoutError):
        await agent_service.invoke_agent([])
    assert seen["config"] == {"recursion_limit": agent_service.AGENT_RECURSION_LIMIT}
    assert agent_service.AGENT_RECURSION_LIMIT == 12


# --- S7: JWKS fetch must not block the event loop ------------------------------------


def test_get_current_user_is_sync_so_fastapi_runs_it_in_the_threadpool(monkeypatch):
    user_id = uuid.uuid4()
    assert not inspect.iscoroutinefunction(get_current_user)
    monkeypatch.setattr(auth_dependencies, "verify_access_token", lambda token: {"sub": str(user_id)})

    user = get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="t"))

    assert user.id == user_id


# --- S8: DB conflicts are 409s, not 500s ---------------------------------------------


@pytest_asyncio.fixture
async def real_session_client(engine, monkeypatch):
    """The app with its real session dependency (so cleanup on error is exercised)."""
    factory = async_sessionmaker(engine, expire_on_commit=False)
    sessions: list = []

    def tracking_factory():
        sessions.append(factory())
        return sessions[-1]

    monkeypatch.setattr(db_session, "get_session_factory", lambda: tracking_factory)
    user_id = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=user_id, role="authenticated")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with factory() as setup:
            await ProfileService(setup).create_profile(user_id)
        sessions.clear()
        yield client, sessions
    app.dependency_overrides.clear()


async def test_renaming_to_an_existing_name_is_409_and_the_session_is_rolled_back(
    real_session_client,
):
    client, sessions = real_session_client
    cafe = (await client.post("/api/v1/payees", json={"name": "Corner Cafe", "type": "expense"})).json()
    bistro = (await client.post("/api/v1/payees", json={"name": "Bistro", "type": "expense"})).json()

    payee = await client.patch(f"/api/v1/payees/{bistro['id']}", json={"name": "corner CAFE"})

    assert payee.status_code == 409 and payee.json() == CONFLICT
    assert not sessions[-1].in_transaction()  # rolled back and closed by the dependency

    categories = (await client.get("/api/v1/categories")).json()["categories"]
    food, fuel = (next(c for c in categories if c["name"] == n) for n in ("Food", "Fuel"))
    category = await client.patch(f"/api/v1/categories/{fuel['id']}", json={"name": food["name"]})
    assert category.status_code == 409 and category.json() == CONFLICT
    assert cafe["id"] != bistro["id"]


async def test_renaming_a_payee_succeeds(api_client, session):
    """Regression: a successful rename used to 500 (updated_at lazy-loaded in async)."""
    client, _ = await _profile(api_client, session)
    payee = (await client.post("/api/v1/payees", json={"name": "Old Name", "type": "expense"})).json()

    renamed = await client.patch(f"/api/v1/payees/{payee['id']}", json={"name": "New Name"})

    assert renamed.status_code == 200 and renamed.json()["name"] == "New Name"


async def test_racing_first_login_yields_a_single_profile(engine, session):
    user_id = uuid.uuid4()
    async with async_sessionmaker(engine, expire_on_commit=False)() as winner:
        won = await ProfileService(winner).create_profile(user_id)

    lost = await ProfileService(session).create_profile(user_id)  # its INSERT conflicts

    assert lost.id == won.id == user_id
    assert await session.scalar(select(func.count()).select_from(Profile)) == 1
    assert await session.scalar(select(func.count()).select_from(Category)) == 36


async def test_invalid_goal_type_is_rejected_not_a_500(api_client, session):
    client, user_id = await _profile(api_client, session)

    response = await client.post(
        "/api/v1/goals", json={"title": "Trip", "target_amount": 1000, "goal_type": "nonsense"}
    )
    assert response.status_code == 422

    with pytest.raises(ValueError, match="goal_type"):  # the AI-tool path shares this guard
        await GoalService(session).add_goal(user_id, title="Trip", target_amount=1000, goal_type="nonsense")
    with request_context(user_id, session):
        tool = await add_goal.ainvoke({"title": "Trip", "target_amount": 10, "goal_type": "nonsense"})
    assert tool["status"] == "error"


# --- S9: input validation ------------------------------------------------------------


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/profile", {"currency": "inr"}),
        ("/api/v1/profile", {"currency": "RUPEES"}),
        ("/api/v1/profile", {"timezone": "Mars/Base"}),
        ("/api/v1/profile", {"timezone": "x" * 10_000}),
        ("/api/v1/categories", {"name": "A", "type": "expense", "color": "red"}),
        ("/api/v1/categories", {"name": "A", "type": "expense", "color": "#12345"}),
        ("/api/v1/categories", {"name": "A", "type": "expense", "color": "#GGGGGG"}),
        ("/api/v1/categories", {"name": "A", "type": "expense", "icon": "i" * 33}),
        ("/api/v1/goals", {"title": "G", "target_amount": 100, "description": "d" * 1001}),
        ("/api/v1/goals", {"title": "G", "target_amount": 100, "priority": "urgent"}),
    ],
)
async def test_bad_input_is_422(api_client, session, path, payload):
    client, _ = await _profile(api_client, session)
    assert (await client.post(path, json=payload)).status_code == 422


async def test_transaction_text_fields_are_length_limited(api_client, session):
    client, user_id = await _profile(api_client, session)
    food = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    base = {"category_id": str(food.id), "amount": 100, "transaction_type": "expense"}

    assert (await client.post("/api/v1/transactions", json={**base, "description": "d" * 501})).status_code == 422
    assert (await client.post("/api/v1/transactions", json={**base, "notes": "n" * 2001})).status_code == 422
    ok = await client.post("/api/v1/transactions", json={**base, "description": "d" * 500, "notes": "n" * 2000})
    assert ok.status_code == 200
    patch = await client.patch(f"/api/v1/transactions/{ok.json()['id']}", json={"description": "d" * 501})
    assert patch.status_code == 422


async def test_valid_profile_category_and_goal_input_still_works(api_client, session):
    client, _ = await _profile(api_client, session)
    profile = await client.post("/api/v1/profile", json={"currency": "USD", "timezone": "Asia/Kolkata"})
    category = await client.post(
        "/api/v1/categories", json={"name": "Pets2", "type": "expense", "color": "#A1b2C3", "icon": "public-transit"}
    )
    goal = await client.post(
        "/api/v1/goals", json={"title": "G", "target_amount": 100, "priority": "high", "goal_type": "vacation"}
    )
    assert (profile.status_code, category.status_code, goal.status_code) == (200, 200, 200)
    assert profile.json()["currency"] == "USD"


# --- S10 / S11: type consistency -----------------------------------------------------


async def test_patching_type_with_a_mismatched_category_or_payee_is_400(api_client, session):
    client, user_id = await _profile(api_client, session)
    categories = CategoryRepository(session)
    food = await categories.find_by_name(user_id, "Food", "expense")
    salary = await categories.find_by_name(user_id, "Salary", "income")
    created = await client.post(
        "/api/v1/transactions",
        json={"category_id": str(food.id), "amount": 1000, "transaction_type": "expense"},
    )
    url = f"/api/v1/transactions/{created.json()['id']}"

    mismatch = await client.patch(url, json={"transaction_type": "income"})
    assert mismatch.status_code == 400
    assert (await client.get(url)).json()["transaction_type"] == "expense"  # untouched

    wrong_category = await client.patch(url, json={"category_id": str(salary.id)})
    assert wrong_category.status_code == 400

    income_payee = await PayeeRepository(session).find_or_create(user_id, "Employer X", "income")
    wrong_payee = await client.patch(url, json={"payee_id": str(income_payee.id)})
    assert wrong_payee.status_code == 400

    both = await client.patch(url, json={"transaction_type": "income", "category_id": str(salary.id)})
    assert both.status_code == 200 and both.json()["transaction_type"] == "income"
    # ... and unrelated edits are never blocked by the type check.
    assert (await client.patch(url, json={"notes": "n"})).status_code == 200


async def test_category_type_cannot_be_changed(api_client, session):
    client, user_id = await _profile(api_client, session)
    food = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    url = f"/api/v1/categories/{food.id}"

    only_type = await client.patch(url, json={"type": "income"})
    renamed = await client.patch(url, json={"name": "Food & Co", "type": "income"})  # what the web edit form sends

    assert only_type.status_code == 422  # nothing but an ignored field
    assert renamed.status_code == 200
    assert renamed.json()["type"] == "expense" and renamed.json()["name"] == "Food & Co"


# --- S12: goal status ----------------------------------------------------------------


async def test_completed_goal_can_be_archived_and_stays_archived(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    goals = GoalService(session)
    goal = await goals.add_goal(user_id, title="Laptop", target_amount=1000, current_amount=1000)
    goal_id = uuid.UUID(goal["id"])
    assert goal["status"] == "completed"

    archived = await goals.update_goal(user_id, goal_id, status="archived")
    assert archived["status"] == "archived"

    # Progress updates never resurrect an archived goal ...
    assert (await goals.update_goal(user_id, goal_id, current_amount=200))["status"] == "archived"
    assert (await goals.update_goal(user_id, goal_id, current_amount=1000))["status"] == "archived"


async def test_progress_still_toggles_active_and_completed(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    goals = GoalService(session)
    goal_id = uuid.UUID((await goals.add_goal(user_id, title="Bike", target_amount=1000))["id"])

    assert (await goals.update_goal(user_id, goal_id, current_amount=1000))["status"] == "completed"
    assert (await goals.update_goal(user_id, goal_id, current_amount=10))["status"] == "active"


# --- S13: a failing tool must not turn into a 500 ------------------------------------


async def test_tool_db_failure_returns_the_friendly_message(api_client, session, monkeypatch):
    client, user_id = await _profile(api_client, session)

    async def agent(messages):
        # A tool whose write fails leaves the session unusable until rollback.
        session.add(Category(user_id=user_id, name="Food", type="expense"))  # duplicates a default
        await session.flush()

    monkeypatch.setattr(chat_service, "invoke_agent", agent)

    response = await client.post("/api/v1/chat", json={"message": "add a Food category"})

    assert response.status_code == 200
    assert "encountered an error" in response.json()["response"]
    rows = (await session.scalars(select(Message).where(Message.user_id == user_id))).all()
    assert sorted((r.role.value, r.status.value) for r in rows) == [
        ("assistant", "failed"),
        ("user", "completed"),
    ]


# --- B1 / B2 -------------------------------------------------------------------------


async def test_pagination_is_stable_when_date_and_created_at_tie(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    food = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    repo = TransactionRepository(session)
    tied = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
    ids = [
        (
            await repo.create(
                user_id,
                category_id=food.id,
                amount=100 + n,
                transaction_type="expense",
                transaction_date=date(2026, 1, 1),
                created_at=tied,
            )
        ).id
        for n in range(5)
    ]
    await session.commit()

    pages = [await repo.list(user_id, limit=2, offset=offset) for offset in (0, 2, 4)]
    listed = [row.id for page in pages for row in page]

    assert listed == sorted(ids, reverse=True)  # no duplicates, no gaps, id breaks the tie


async def test_transactions_default_to_the_profile_currency(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id, currency="USD")
    food = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)

    default = await service.add_transaction(user_id, category_id=food.id, amount=500, transaction_type="expense")
    explicit = await service.add_transaction(
        user_id, category_id=food.id, amount=500, transaction_type="expense", currency="EUR"
    )

    assert (default["currency"], explicit["currency"]) == ("USD", "EUR")
