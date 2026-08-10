from datetime import date
from uuid import UUID

from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.repositories import CategoryRepository
from ai_service.services.goal_service import GoalNotFoundError, GoalService
from ai_service.utils.financial import amount_to_minor


@tool
async def get_financial_goals(status: str = "active") -> dict:
    """List financial goals with integer and display progress values."""
    return await GoalService(get_db_session()).list_goals(get_current_user_id(), status=status)


@tool
async def add_goal(
    title: str,
    target_amount: float,
    goal_type: str | None = None,
    target_date: str | None = None,
    description: str | None = None,
    priority: str | None = None,
    category: str | None = None,
) -> dict:
    """Create a goal; target amounts are supplied in normal currency values."""
    user_id = get_current_user_id()
    session = get_db_session()
    parsed_date = None
    try:
        if target_date:
            parsed_date = date.fromisoformat(target_date)
        category_id = None
        if category:
            category_row = await CategoryRepository(session).find_by_name(user_id, category, "expense")
            if category_row is None:
                return {"status": "error", "message": f"Category '{category}' not found."}
            category_id = category_row.id
        return await GoalService(session).add_goal(
            user_id,
            title=title,
            target_amount=amount_to_minor(target_amount),
            goal_type=goal_type,
            target_date=parsed_date,
            description=description,
            priority=priority,
            category_id=category_id,
        )
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}


@tool
async def update_goal_progress(goal_id: str, current_amount: float) -> dict:
    """Update the manually tracked amount saved toward a goal."""
    try:
        return await GoalService(get_db_session()).update_progress(
            get_current_user_id(),
            goal_id=UUID(goal_id),
            current_amount=amount_to_minor(current_amount),
        )
    except (GoalNotFoundError, ValueError) as exc:
        return {"status": "error", "message": str(exc)}
