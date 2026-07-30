from fastapi import APIRouter

from ai_service.schemas.chat import ChatRequest, ChatResponse
from ai_service.services.agent_service import run_agent

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the AI assistant and get a response."""
    return await run_agent(
        message=request.message,
        conversation_id=request.conversation_id,
    )
