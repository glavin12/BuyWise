from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.financial import TransferCreate, TransferResponse
from ai_service.services.transfer_service import TransferService

router = APIRouter(prefix="/api/v1/transfers", tags=["transfers"])
settings = get_settings()


@router.post("", response_model=TransferResponse)
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def create_transfer(request: Request, response: Response, body: TransferCreate, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    try:
        return await TransferService(session).create_transfer(current_user.id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{transfer_group_id}")
@limiter.limit(settings.FINANCIAL_RATE_LIMIT)
async def delete_transfer(transfer_group_id: UUID, request: Request, response: Response, session: AsyncSession = Depends(get_async_session), current_user: CurrentUser = Depends(get_current_user)):
    deleted = await TransferService(session).delete_transfer(current_user.id, transfer_group_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return {"status": "deleted", "transfer_group_id": str(transfer_group_id)}
