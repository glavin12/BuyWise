from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import PayeeCreate, PayeeListResponse, PayeeResponse, PayeeUpdate
from ai_service.services.payee_service import PayeeNotFoundError, PayeeService

router = APIRouter(prefix="/api/v1/payees", tags=["payees"])
settings = get_settings()


@router.post("", response_model=PayeeResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_payee(request: Request, response: Response, body: PayeeCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await PayeeService(session).create_payee(current_user.id, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=PayeeListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_payees(request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    return {"payees": await PayeeService(session).list_payees(current_user.id)}


@router.get("/{payee_id}", response_model=PayeeResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_payee(payee_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await PayeeService(session).get_payee(current_user.id, payee_id)
    except PayeeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{payee_id}", response_model=PayeeResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_payee(payee_id: UUID, request: Request, response: Response, body: PayeeUpdate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await PayeeService(session).update_payee(current_user.id, payee_id, body.name)
    except (ValueError, PayeeNotFoundError) as exc:
        raise HTTPException(status_code=404 if isinstance(exc, PayeeNotFoundError) else 400, detail=str(exc)) from exc


@router.delete("/{payee_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_payee(payee_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        await PayeeService(session).delete_payee(current_user.id, payee_id)
        return {"status": "deleted", "payee_id": str(payee_id)}
    except PayeeNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
