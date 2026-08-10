from __future__ import annotations

import uuid

import pytest

from ai_service.services.account_service import AccountService
from ai_service.services.transfer_service import TransferService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_transfer_is_atomic_and_deletable(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    accounts = AccountService(session)
    source = await accounts.create_account(user_id, name="A", account_type="cash")
    target = await accounts.create_account(user_id, name="B", account_type="cash")
    transfer = await TransferService(session).create_transfer(
        user_id,
        from_account_id=uuid.UUID(source["id"]),
        to_account_id=uuid.UUID(target["id"]),
        amount=100,
    )
    assert await TransferService(session).delete_transfer(
        user_id, uuid.UUID(transfer["transfer_group_id"])
    )
