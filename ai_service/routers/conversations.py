from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.conversation import (
    ConversationCreate,
    ConversationHistory,
    ConversationRead,
    Message,
)
from ai_service.services.conversation_service import (
    ConversationNotFoundError,
    ConversationService,
)

router = APIRouter(prefix="/api/v1", tags=["conversations"])
settings = get_settings()


@router.post("/conversations", response_model=ConversationRead)
@limiter.limit(settings.CONVERSATIONS_RATE_LIMIT)
async def create_conversation(
    request: Request,
    response: Response,
    body: ConversationCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new conversation for the authenticated user."""
    service = ConversationService(session)
    return await service.create_conversation(user_id=current_user.id)


@router.get("/conversations", response_model=list[ConversationRead])
@limiter.limit(settings.CONVERSATIONS_RATE_LIMIT)
async def list_conversations(
    request: Request,
    response: Response,
    cursor: datetime | None = None,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List conversations for the authenticated user (scoped by JWT identity)."""
    service = ConversationService(session)
    return await service.list_for_user(current_user.id, cursor=cursor, limit=limit)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationHistory,
)
@limiter.limit(settings.CONVERSATIONS_RATE_LIMIT)
async def get_conversation_messages(
    request: Request,
    response: Response,
    conversation_id: UUID,
    cursor: datetime | None = None,
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get all messages for a conversation (scoped to the authenticated user)."""
    service = ConversationService(session)
    try:
        messages = await service.get_full_history(
            conversation_id=conversation_id,
            user_id=current_user.id,
            cursor=cursor,
            limit=limit,
        )
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ConversationHistory(
        conversation_id=conversation_id,
        messages=[Message.model_validate(m) for m in messages],
    )


@router.delete("/conversations/{conversation_id}")
@limiter.limit(settings.CONVERSATIONS_RATE_LIMIT)
async def delete_conversation(
    request: Request,
    response: Response,
    conversation_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Soft-delete a conversation and hide its message history."""
    service = ConversationService(session)
    deleted = await service.soft_delete_conversation(conversation_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "conversation_id": conversation_id}
