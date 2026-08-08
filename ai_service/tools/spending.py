from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.transaction_service import TransactionService


@tool
async def get_spending_breakdown(period: str = "this_month") -> dict:
    """Analyze the user's spending for a period, grouped by category.

    Returns total spent, daily average, recurring vs one-time split, top
    merchants, and a per-category breakdown with amounts and percentages.
    Use this when the user asks where their money went or how much they spent
    on a category. ``period`` is 'this_month' (default) or 'last_month'.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = TransactionService(session)
    return await service.spending_breakdown(user_id, period=period)


@tool
async def get_income_summary(period: str = "this_month") -> dict:
    """Analyze the user's income for a period, grouped by category.

    Returns total income, recurring vs one-time split, and a per-category
    breakdown. Use this when the user asks how much they earned, or about
    their salary or income sources. ``period`` is 'this_month' (default) or
    'last_month'.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = TransactionService(session)
    return await service.income_summary(user_id, period=period)
