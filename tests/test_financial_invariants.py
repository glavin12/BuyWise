from __future__ import annotations

import uuid
from datetime import date

import pytest

from ai_service.repositories import CategoryRepository
from ai_service.services.account_service import AccountService
from ai_service.services.analytics_service import AnalyticsService
from ai_service.services.profile_service import ProfileService
from ai_service.services.transaction_service import TransactionService
from ai_service.services.transfer_service import TransferService
from ai_service.utils.financial import amount_to_minor, minor_to_amount
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_integer_money_conversion_has_no_float_drift():
    assert amount_to_minor(10.50) == 1050
    assert amount_to_minor("0.005") == 1
    assert minor_to_amount(1050) == 10.5


@pytest.mark.asyncio
async def test_transfers_balance_to_zero_and_are_not_expense(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    account_service = AccountService(session)
    await CategoryRepository(session).seed_defaults(user_id)
    source = await account_service.create_account(
        user_id, name="Checking", account_type="checking", starting_balance=10000
    )
    destination = await account_service.create_account(user_id, name="Savings", account_type="savings")
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    transaction_service = TransactionService(session)
    await transaction_service.add_transaction(
        user_id,
        account_id=uuid.UUID(source["id"]),
        category_id=category.id,
        amount=2500,
        transaction_type="expense",
        transaction_date=date.today(),
    )
    await TransferService(session).create_transfer(
        user_id,
        from_account_id=uuid.UUID(source["id"]),
        to_account_id=uuid.UUID(destination["id"]),
        amount=1000,
    )
    source_after = await account_service.get_account(user_id, uuid.UUID(source["id"]))
    destination_after = await account_service.get_account(user_id, uuid.UUID(destination["id"]))
    assert source_after["balance"] == 6500
    assert destination_after["balance"] == 1000
    summary = await AnalyticsService(session).monthly_summary(
        user_id, date.today().month, date.today().year
    )
    assert summary["expenses"] == 2500
    assert summary["transfers"] == 1000
    assert summary["net"] == -2500


@pytest.mark.asyncio
async def test_starting_balance_is_not_income_or_expense(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    account = await AccountService(session).create_account(
        user_id, name="Cash", account_type="cash", starting_balance=5000
    )
    summary = await AnalyticsService(session).monthly_summary(
        user_id, date.today().month, date.today().year
    )
    assert summary["income"] == 0
    assert summary["expenses"] == 0
    assert summary["net"] == 0
    assert account["balance"] == 5000
