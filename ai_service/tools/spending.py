from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.analytics_service import AnalyticsService


@tool
async def get_spending_breakdown(period: str = "this_month") -> dict:
    """Analyze expense totals by category and payee for this or last month."""
    return await AnalyticsService(get_db_session()).spending_breakdown(
        get_current_user_id(), period=period
    )


@tool
async def get_income_summary(period: str = "this_month") -> dict:
    """Analyze income totals by category for this or last month."""
    return await AnalyticsService(get_db_session()).income_summary(
        get_current_user_id(), period=period
    )
