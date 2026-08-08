from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.monthly_plan_service import MonthlyPlanService
from ai_service.utils.financial import current_month_range


@tool
async def get_budget_status(period: str = "this_month") -> dict:
    """Compare the user's monthly plan against actual spending/income.

    Returns expected vs actual income, total spent, actual savings, whether
    the savings goal is on track, remaining balance, and daily budget
    remaining. Use this when the user asks if they are on budget, on track
    to save, or how much they can spend this month.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = MonthlyPlanService(session)
    return await service.budget_status(user_id, period=period)


@tool
async def set_monthly_plan(
    expected_income: float | None = None,
    minimum_savings_goal: float | None = None,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Set or update the user's monthly financial plan.

    ``expected_income`` is how much the user expects to earn this month and
    ``minimum_savings_goal`` is the minimum they plan to save. Either can be
    omitted to keep the existing value. Defaults to the current month. Use
    this when the user tells you their monthly income or savings target.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = MonthlyPlanService(session)
    window = current_month_range()
    m = month or window.month
    y = year or window.year
    try:
        return await service.set_plan(
            user_id,
            month=m,
            year=y,
            expected_income=expected_income,
            minimum_savings_goal=minimum_savings_goal,
        )
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
