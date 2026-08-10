from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import AccountCreate, AccountListResponse, AccountResponse, AccountUpdate
from ai_service.services.account_service import AccountNotFoundError, AccountService

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
settings = get_settings()


@router.post("", response_model=AccountResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_account(request: Request, response: Response, body: AccountCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await AccountService(session).create_account(current_user.id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=AccountListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_accounts(request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    return {"accounts": await AccountService(session).list_accounts(current_user.id)}


@router.get("/{account_id}", response_model=AccountResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_account(account_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await AccountService(session).get_account(current_user.id, account_id)
    except AccountNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{account_id}", response_model=AccountResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_account(account_id: UUID, request: Request, response: Response, body: AccountUpdate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="No account fields provided")
    try:
        return await AccountService(session).update_account(current_user.id, account_id, **data)
    except (ValueError, AccountNotFoundError) as exc:
        raise HTTPException(status_code=404 if isinstance(exc, AccountNotFoundError) else 400, detail=str(exc)) from exc


@router.delete("/{account_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_account(account_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        await AccountService(session).delete_account(current_user.id, account_id)
        return {"status": "deactivated", "account_id": str(account_id)}
    except AccountNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
