from __future__ import annotations

import urllib.error
import uuid

import pytest
from sqlalchemy import func, select

from ai_service.core.config import get_settings
from ai_service.models import BudgetEntry, Category, Conversation, Goal, Message, MessageRole, Payee, Profile, Transaction
from ai_service.repositories import CategoryRepository
from ai_service.repositories.messages import MessageCreate, MessageRepository
from ai_service.services import account_service
from ai_service.services.account_service import AuthUserDeletionError
from ai_service.services.budget_service import BudgetService
from ai_service.services.goal_service import GoalService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService

OWNED = (Message, Conversation, Transaction, BudgetEntry, Goal, Payee, Category)
SUPABASE = "https://project.supabase.test"


async def _seed(session, user_id: uuid.UUID) -> None:
    """A profile with its default categories and payees, plus one of everything else."""
    await ProfileService(session).create_profile(user_id)
    food = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    await TransactionService(session).add_transaction(
        user_id, category_id=food.id, amount=1000, transaction_type="expense", payee_name="Corner Cafe"
    )
    await BudgetService(session).set_budget(user_id, category_id=food.id, month=1, year=2026, budgeted_amount=5000)
    await GoalService(session).add_goal(user_id, title="Trip", target_amount=100000)
    conversation = Conversation(user_id=user_id, title="Hi")
    session.add(conversation)
    await session.flush()
    await MessageRepository(session).create(
        MessageCreate(conversation_id=conversation.id, user_id=user_id, role=MessageRole.USER, content="hello")
    )
    await session.commit()


async def _counts(session, user_id: uuid.UUID) -> dict[str, int]:
    counts = {
        model.__tablename__: await session.scalar(select(func.count()).select_from(model).where(model.user_id == user_id))
        for model in OWNED
    }
    counts["profiles"] = await session.scalar(select(func.count()).select_from(Profile).where(Profile.id == user_id))
    return counts


@pytest.fixture
def admin(monkeypatch):
    """Account deletion configured, with the Supabase Admin call replaced by a recorder."""
    settings = get_settings()
    monkeypatch.setattr(settings, "SUPABASE_URL", SUPABASE)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test")
    calls: list[tuple[str, str, uuid.UUID]] = []
    monkeypatch.setattr(account_service, "_delete_auth_user", lambda *args: calls.append(args))
    return calls


@pytest.mark.asyncio
async def test_delete_account_removes_the_callers_data_and_nobody_elses(api_client, session, admin):
    client, user_id = api_client
    other = uuid.uuid4()
    await _seed(session, user_id)
    await _seed(session, other)
    before = await _counts(session, other)
    assert before["profiles"] == 1 and before["categories"] == 36 and before["transactions"] == 1

    response = await client.delete("/api/v1/profile")

    assert response.status_code == 204
    assert response.content == b""
    assert set((await _counts(session, user_id)).values()) == {0}
    assert await _counts(session, other) == before
    assert admin == [(SUPABASE, "sb_secret_test", user_id)]


@pytest.mark.asyncio
async def test_delete_account_can_be_repeated(api_client, session, admin):
    client, user_id = api_client
    await _seed(session, user_id)

    assert (await client.delete("/api/v1/profile")).status_code == 204
    assert (await client.delete("/api/v1/profile")).status_code == 204  # nothing left to delete is not an error

    assert len(admin) == 2


@pytest.mark.asyncio
async def test_delete_account_without_a_service_key_deletes_nothing(api_client, session, monkeypatch):
    client, user_id = api_client
    settings = get_settings()
    monkeypatch.setattr(settings, "SUPABASE_URL", SUPABASE)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    called = []
    monkeypatch.setattr(account_service, "_delete_auth_user", lambda *args: called.append(args))
    await _seed(session, user_id)
    before = await _counts(session, user_id)

    response = await client.delete("/api/v1/profile")

    assert response.status_code == 503
    assert response.json()["detail"] == "Account deletion is not configured"
    assert await _counts(session, user_id) == before
    assert called == []


@pytest.mark.asyncio
async def test_a_failed_login_deletion_is_a_502_and_a_retry_finishes_it(api_client, session, monkeypatch):
    client, user_id = api_client
    settings = get_settings()
    monkeypatch.setattr(settings, "SUPABASE_URL", SUPABASE)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test")
    outcomes = [AuthUserDeletionError("down"), None]

    def flaky(*args):
        outcome = outcomes.pop(0)
        if outcome:
            raise outcome

    monkeypatch.setattr(account_service, "_delete_auth_user", flaky)
    await _seed(session, user_id)

    first = await client.delete("/api/v1/profile")
    assert first.status_code == 502
    assert "SUPABASE" not in first.text and "sb_secret" not in first.text
    assert set((await _counts(session, user_id)).values()) == {0}  # the data went before the login was tried

    assert (await client.delete("/api/v1/profile")).status_code == 204


def test_the_admin_request_sends_each_key_type_the_way_supabase_accepts_it():
    user_id = uuid.uuid4()

    secret = account_service._build_delete_request(f"{SUPABASE}/", "sb_secret_abc", user_id)
    assert secret.full_url == f"{SUPABASE}/auth/v1/admin/users/{user_id}"
    assert secret.get_method() == "DELETE"
    assert secret.headers == {"Apikey": "sb_secret_abc"}  # not a JWT, so not a bearer token

    legacy = account_service._build_delete_request(SUPABASE, "eyJhbGciOi.payload.sig", user_id)
    assert legacy.headers == {"Apikey": "eyJhbGciOi.payload.sig", "Authorization": "Bearer eyJhbGciOi.payload.sig"}


def test_the_admin_call_treats_a_missing_login_as_done_and_other_failures_as_errors(monkeypatch):
    user_id = uuid.uuid4()

    def fail_with(error):
        def urlopen(*args, **kwargs):
            raise error

        monkeypatch.setattr(account_service.urllib.request, "urlopen", urlopen)

    fail_with(urllib.error.HTTPError(SUPABASE, 404, "Not Found", {}, None))
    account_service._delete_auth_user(SUPABASE, "sb_secret_abc", user_id)  # already gone: success

    for error in (
        urllib.error.HTTPError(SUPABASE, 401, "Unauthorized", {}, None),
        urllib.error.HTTPError(SUPABASE, 500, "Server Error", {}, None),
        urllib.error.URLError("no route"),
        TimeoutError(),
    ):
        fail_with(error)
        with pytest.raises(AuthUserDeletionError):
            account_service._delete_auth_user(SUPABASE, "sb_secret_abc", user_id)
