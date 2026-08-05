from datetime import date

from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.goal_service import GoalNotFoundError, GoalService


@tool
async def get_financial_goals(status: str = "active") -> dict:
    """List the user's financial goals with progress metrics.

    Returns each goal's target/current amount, progress percent, remaining
    amount, target date, and the monthly contribution needed to hit it on
    time. Use this when the user asks about their savings goals or progress.
    ``status`` is 'active' (default), 'completed', or 'archived'.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = GoalService(session)
    return await service.list_goals(user_id, status=status)


@tool
async def add_goal(
    title: str,
    target_amount: float,
    goal_type: str | None = None,
    target_date: str | None = None,
    description: str | None = None,
    priority: str | None = None,
) -> dict:
    """Create a new financial goal for the user.

    ``title`` is the goal name (e.g. 'Emergency Fund'). ``target_amount`` is a
    positive number. ``goal_type`` is one of emergency_fund, purchase,
    vacation, investment, debt_repayment, education, retirement, custom.
    ``target_date`` is an ISO date (YYYY-MM-DD) — optional. Use this when the
    user asks to create or save toward a new goal.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = GoalService(session)
    parsed_date: date | None = None
    if target_date:
        try:
            parsed_date = date.fromisoformat(target_date)
        except ValueError:
            return {"status": "error", "message": f"Invalid target_date '{target_date}'. Use YYYY-MM-DD."}
    try:
        return await service.add_goal(
            user_id,
            title=title,
            target_amount=target_amount,
            goal_type=goal_type,
            description=description,
            priority=priority,
            target_date=parsed_date,
        )
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}


@tool
async def update_goal_progress(goal_id: str, current_amount: float) -> dict:
    """Update the current amount saved toward a financial goal.

    ``goal_id`` is the goal's id string. ``current_amount`` is the total saved
    so far (non-negative). Use this when the user says they added money to a
    goal. Marks the goal completed automatically when the target is reached.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = GoalService(session)
    try:
        from uuid import UUID

        return await service.update_progress(
            user_id,
            goal_id=UUID(goal_id),
            current_amount=current_amount,
        )
    except GoalNotFoundError as exc:
        return {"status": "error", "message": str(exc)}
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
