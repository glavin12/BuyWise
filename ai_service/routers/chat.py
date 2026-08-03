from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.db.session import get_async_session
from ai_service.schemas.chat import ChatRequest, ChatResponse
from ai_service.services.chat_service import ChatService
from ai_service.services.conversation_service import ConversationNotFoundError

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send a message to the AI assistant and get a response.

    The authenticated user is derived from the verified JWT; the request body
    never carries ``user_id``.
    """
    service = ChatService(session)
    try:
        return await service.send_message(
            message=request.message,
            user_id=current_user.id,
            conversation_id=request.conversation_id,
            idempotency_key=request.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
