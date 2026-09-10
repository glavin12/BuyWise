from __future__ import annotations

from datetime import date

import pytest

from ai_service.repositories import CategoryRepository, TransactionRepository
from ai_service.services.analytics_service import AnalyticsService
from ai_service.services.transaction_service import TransactionService
from ai_service.utils.financial import amount_to_minor, minor_to_amount
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_integer_money_conversion_has_no_float_drift():
    assert amount_to_minor(10.50) == 1050
    assert amount_to_minor("0.005") == 1
    assert minor_to_amount(1050) == 10.5


@pytest.mark.asyncio
async def test_starting_balance_is_not_income_or_expense(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    await TransactionService(session).add_transaction(
        user_id, amount=5000, transaction_type="starting_balance"
    )
    summary = await AnalyticsService(session).monthly_summary(
        user_id, date.today().month, date.today().year
    )
    assert summary["income"] == 0
    assert summary["expenses"] == 0
    assert summary["net"] == 0
    balance = await TransactionRepository(session).get_balance(user_id)
    assert balance == 5000


@pytest.mark.asyncio
async def test_spending_splits_by_payment_method(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    await CategoryRepository(session).seed_defaults(user_id)
    category = await CategoryRepository(session).find_by_name(user_id, "Food", "expense")
    service = TransactionService(session)
    await service.add_transaction(
        user_id, category_id=category.id, amount=1000,
        transaction_type="expense", payment_method="cash",
    )
    await service.add_transaction(
        user_id, category_id=category.id, amount=3000,
        transaction_type="expense", payment_method="upi",
    )
    rows = await AnalyticsService(session).payment_method_spending(
        user_id, date.today().month, date.today().year
    )
    by_method = {row["payment_method"]: row["amount"] for row in rows}
    assert by_method == {"upi": 3000, "cash": 1000}
    # ordered by amount descending
    assert rows[0]["payment_method"] == "upi"
