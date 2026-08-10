from __future__ import annotations

import pytest

from ai_service.services.account_service import AccountService
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
