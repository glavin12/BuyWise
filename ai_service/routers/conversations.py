from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.post("/conversations", response_model=ConversationRead)
async def create_conversation(
    request: ConversationCreate,
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new conversation for a user."""
    service = ConversationService(session)
    return await service.create_conversation(user_id=request.user_id)


@router.get("/users/{user_id}/conversations", response_model=list[ConversationRead])
async def get_user_conversations(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
):
    """Get conversations for a user."""
    service = ConversationService(session)
    return await service.list_for_user(user_id)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationHistory,
)
async def get_conversation_messages(
    conversation_id: UUID,
    user_id: UUID = Query(..., description="The authenticated user's ID."),
    cursor: datetime | None = None,
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all messages for a conversation (scoped to the user)."""
    service = ConversationService(session)
    try:
        messages = await service.get_full_history(
            conversation_id=conversation_id,
            user_id=user_id,
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
async def delete_conversation(
    conversation_id: UUID,
    user_id: UUID = Query(..., description="The authenticated user's ID."),
    session: AsyncSession = Depends(get_async_session),
):
    """Soft-delete a conversation and hide its message history."""
    service = ConversationService(session)
    deleted = await service.soft_delete_conversation(conversation_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "conversation_id": conversation_id}
