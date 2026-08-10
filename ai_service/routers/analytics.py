from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import CategorySpendingResponse, MonthComparisonResponse, MonthlySummaryResponse
from ai_service.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
settings = get_settings()


@router.get("/monthly", response_model=MonthlySummaryResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def monthly_analytics(request: Request, response: Response, month: int = Query(..., ge=1, le=12), year: int = Query(..., ge=2020, le=2100), session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await AnalyticsService(session).monthly_summary(current_user.id, month, year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/categories", response_model=list[CategorySpendingResponse])
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def category_analytics(request: Request, response: Response, month: int = Query(..., ge=1, le=12), year: int = Query(..., ge=2020, le=2100), session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    return await AnalyticsService(session).category_spending(current_user.id, month, year)


@router.get("/comparison", response_model=MonthComparisonResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def comparison_analytics(request: Request, response: Response, month1: int = Query(..., ge=1, le=12), year1: int = Query(..., ge=2020, le=2100), month2: int = Query(..., ge=1, le=12), year2: int = Query(..., ge=2020, le=2100), session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    return await AnalyticsService(session).month_comparison(current_user.id, month1, year1, month2, year2)
