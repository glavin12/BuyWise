from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import BudgetCreate, BudgetMonthResponse, BudgetResponse, BudgetUpdate
from ai_service.services.budget_service import BudgetNotFoundError, BudgetService

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])
settings = get_settings()


@router.post("", response_model=BudgetResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def set_budget(request: Request, response: Response, body: BudgetCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await BudgetService(session).set_budget(current_user.id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{month}", response_model=BudgetMonthResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_month_budgets(month: str, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        year_text, month_text = month.split("-", 1)
        year, month_number = int(year_text), int(month_text)
        budgets = await BudgetService(session).get_month_budgets(current_user.id, month_number, year)
        return {"month": month_number, "year": year, "budgets": budgets}
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="month must use YYYY-MM format") from exc


@router.get("/id/{budget_id}", response_model=BudgetResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_budget(budget_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await BudgetService(session).get_budget(current_user.id, budget_id)
    except BudgetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{budget_id}", response_model=BudgetResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_budget(budget_id: UUID, request: Request, response: Response, body: BudgetUpdate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await BudgetService(session).update_budget(current_user.id, budget_id, body.budgeted_amount)
    except (ValueError, BudgetNotFoundError) as exc:
        raise HTTPException(status_code=404 if isinstance(exc, BudgetNotFoundError) else 400, detail=str(exc)) from exc


@router.delete("/{budget_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_budget(budget_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        await BudgetService(session).delete_budget(current_user.id, budget_id)
        return {"status": "deleted", "budget_id": str(budget_id)}
    except BudgetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
