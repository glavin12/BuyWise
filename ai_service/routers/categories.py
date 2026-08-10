from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import CategoryCreate, CategoryListResponse, CategoryResponse, CategoryUpdate
from ai_service.services.category_service import CategoryNotFoundError, CategoryService

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])
settings = get_settings()


@router.post("", response_model=CategoryResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_category(request: Request, response: Response, body: CategoryCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await CategoryService(session).create_category(current_user.id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=CategoryListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_categories(request: Request, response: Response, type: str | None = Query(None, pattern="^(expense|income)$"), session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    return await CategoryService(session).list_categories(current_user.id, type=type)


@router.get("/{category_id}", response_model=CategoryResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_category(category_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await CategoryService(session).get_category(current_user.id, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{category_id}", response_model=CategoryResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_category(category_id: UUID, request: Request, response: Response, body: CategoryUpdate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="No category fields provided")
    try:
        return await CategoryService(session).update_category(current_user.id, category_id, **data)
    except (ValueError, CategoryNotFoundError) as exc:
        raise HTTPException(status_code=404 if isinstance(exc, CategoryNotFoundError) else 400, detail=str(exc)) from exc


@router.delete("/{category_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_category(category_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        await CategoryService(session).delete_category(current_user.id, category_id)
        return {"status": "deactivated", "category_id": str(category_id)}
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
