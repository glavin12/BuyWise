from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import TransactionCreate, TransactionListResponse, TransactionResponse, TransactionUpdate
from ai_service.services.transaction_service import (
    CategoryNotFoundError,
    PayeeReferenceError,
    TransactionNotFoundError,
    TransactionService,
)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])
settings = get_settings()


@router.post("", response_model=TransactionResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_transaction(request: Request, response: Response, body: TransactionCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await TransactionService(session).add_transaction(current_user.id, **body.model_dump())
    except (ValueError, CategoryNotFoundError, PayeeReferenceError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=TransactionListResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def list_transactions(
    request: Request,
    response: Response,
    category_id: UUID | None = None,
    payee_id: UUID | None = None,
    transaction_type: str | None = Query(None, pattern="^(expense|income|starting_balance)$"),
    cleared_status: str | None = Query(None, pattern="^(pending|cleared)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    period: str | None = Query(None, pattern="^(this_month|last_month)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await TransactionService(session).list_transactions(
        current_user.id,
        category_id=category_id,
        payee_id=payee_id,
        transaction_type=transaction_type,
        cleared_status=cleared_status,
        date_from=date_from,
        date_to=date_to,
        period=period,
        limit=limit,
        offset=offset,
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def get_transaction(transaction_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await TransactionService(session).get_transaction(current_user.id, transaction_id)
    except TransactionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{transaction_id}", response_model=TransactionResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def update_transaction(transaction_id: UUID, request: Request, response: Response, body: TransactionUpdate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="No transaction fields provided")
    try:
        return await TransactionService(session).update_transaction(current_user.id, transaction_id, **data)
    except (ValueError, CategoryNotFoundError, PayeeReferenceError, TransactionNotFoundError) as exc:
        raise HTTPException(status_code=404 if isinstance(exc, TransactionNotFoundError) else 400, detail=str(exc)) from exc


@router.delete("/{transaction_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_transaction(transaction_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        await TransactionService(session).delete_transaction(current_user.id, transaction_id)
        return {"status": "deleted", "transaction_id": str(transaction_id)}
    except TransactionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
