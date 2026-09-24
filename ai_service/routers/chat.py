from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.chat import ChatRequest, ChatResponse
from ai_service.services.chat_service import ChatService
from ai_service.services.conversation_service import (
    ConversationNotFoundError,
    MessageInProgressError,
)

router = APIRouter(prefix="/api/v1", tags=["chat"])
settings = get_settings()


@router.post("/chat", response_model=ChatResponse)
@limiter.limit(settings.CHAT_RATE_LIMIT)
async def chat(
    request: Request,
    response: Response,
    body: ChatRequest,
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
            message=body.message,
            user_id=current_user.id,
            conversation_id=body.conversation_id,
            idempotency_key=body.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MessageInProgressError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
