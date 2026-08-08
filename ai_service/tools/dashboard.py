from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.dashboard_service import DashboardService


@tool
async def get_dashboard(period: str = "this_month") -> dict:
    """Get the user's current-month financial dashboard snapshot.

    Returns expected vs actual income, total spent, current balance, savings,
    and active goal count for the given period. Use this when the user asks for
    an overall financial overview: balance, spending, income, or savings.
    ``period`` is 'this_month' (default) or 'last_month'.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = DashboardService(session)
    return await service.get_dashboard(user_id, period=period)
