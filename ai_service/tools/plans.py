from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session, get_today
from ai_service.repositories import CategoryRepository
from ai_service.services.budget_service import BudgetService
from ai_service.utils.financial import amount_to_minor, current_month_range


@tool
async def get_budget_status(period: str = "this_month") -> dict:
    """Compare per-category budgets with actual expense totals.

    Budgets roll over: each category row has this month's display_budgeted_amount,
    display_spent and display_remaining, plus display_carried_in (what earlier
    months left over, negative if overspent) and display_available (carry-over
    plus this month's remaining). `carried` lists categories that carry money but
    have no budget this month. display_unassigned is the closing balance minus
    all envelope money, not yet given a job."""
    return await BudgetService(get_db_session()).budget_status(
        get_current_user_id(), period=period, today=get_today()
    )


@tool
async def set_category_budget(
    category: str,
    budgeted_amount: float,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Set the amount assigned to one expense category for a month. Unspent money and
    overspending carry into later months."""
    user_id = get_current_user_id()
    session = get_db_session()
    window = current_month_range(get_today())
    category_row = await CategoryRepository(session).find_by_name(user_id, category, "expense")
    if category_row is None:
        return {"status": "error", "message": f"Expense category '{category}' not found."}
    try:
        return await BudgetService(session).set_budget(
            user_id,
            category_id=category_row.id,
            budgeted_amount=amount_to_minor(budgeted_amount),
            month=month or window.month,
            year=year or window.year,
        )
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
