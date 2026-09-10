from __future__ import annotations

import uuid

import pytest

from ai_service.services.account_service import AccountService
from ai_service.services.profile_service import ProfileService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_account_creation_with_starting_balance(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    account = await AccountService(session).create_account(
        user_id,
        name="Wallet",
        account_type="cash",
        starting_balance=12345,
    )
    assert account["balance"] == 12345
    assert account["display_balance"] == 123.45


@pytest.mark.asyncio
async def test_account_creation_initializes_missing_profile(session):
    user_id = uuid.uuid4()

    account = await AccountService(session).create_account(
        user_id,
        name="Savings",
        account_type="savings",
    )

    profile = await ProfileService(session).get_profile(user_id)
    accounts = await AccountService(session).list_accounts(user_id)

    assert profile is not None
    assert {item["name"] for item in accounts} == {"Cash", "Savings"}
    assert account["name"] == "Savings"
