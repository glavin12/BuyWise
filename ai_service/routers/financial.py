from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import (
    DashboardResponse,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    GoalsListResponse,
)
from ai_service.services.dashboard_service import DashboardService
from ai_service.services.goal_service import GoalNotFoundError, GoalService

router = APIRouter(prefix="/api/v1", tags=["financial"])
settings = get_settings()


@router.get("/dashboard", response_model=DashboardResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_dashboard(
    request: Request,
    response: Response,
    period: str = Query("this_month", pattern="^(this_month|last_month)$"),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await DashboardService(session).get_dashboard(current_user.id, period=period)


@router.get("/goals", response_model=GoalsListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_goals(
    request: Request,
    response: Response,
    status: str = Query("active", pattern="^(active|completed|archived)$"),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await GoalService(session).list_goals(current_user.id, status=status)


@router.post("/goals", response_model=GoalResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_goal(
    request: Request,
    response: Response,
    body: GoalCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await GoalService(session).add_goal(current_user.id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/goals/{goal_id}", response_model=GoalResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_goal(
    request: Request,
    response: Response,
    goal_id: UUID,
    body: GoalUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await GoalService(session).update_goal(
            current_user.id,
            goal_id,
            **body.model_dump(exclude_unset=True),
        )
    except (ValueError, GoalNotFoundError) as exc:
        status_code = 404 if isinstance(exc, GoalNotFoundError) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
