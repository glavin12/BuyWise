from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import (
    DashboardResponse,
    GoalsListResponse,
    TransactionsListResponse,
)
from ai_service.services.dashboard_service import DashboardService
from ai_service.services.goal_service import GoalService
from ai_service.services.transaction_service import TransactionService

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
    service = DashboardService(session)
    return await service.get_dashboard(current_user.id, period=period)


@router.get("/goals", response_model=GoalsListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_goals(
    request: Request,
    response: Response,
    status: str = Query("active", pattern="^(active|completed|archived)$"),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    service = GoalService(session)
    return await service.list_goals(current_user.id, status=status)


@router.get("/transactions", response_model=TransactionsListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_transactions(
    request: Request,
    response: Response,
    limit: int = Query(10, ge=1, le=100),
    period: str | None = Query(None, pattern="^(this_month|last_month)$"),
    type: str | None = Query(None, pattern="^(expense|income)$"),
    category: str | None = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    service = TransactionService(session)

    category_id = None
    if category is not None:
        from ai_service.repositories import CategoryRepository

        repo = CategoryRepository(session)
        cat = await repo.find_by_name(category, type or "expense")
        if cat is not None:
            category_id = cat.id

    return await service.list_transactions(
        current_user.id,
        limit=limit,
        type=type,
        category_id=category_id,
        period=period,
    )
