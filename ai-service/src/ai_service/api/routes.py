"""Chat API routes."""

from fastapi import APIRouter, HTTPException

from ai_service.models.chat import ChatRequest, ChatResponse
from ai_service.services.agent_service import FinancialAgentService
from ai_service.utils.settings import get_settings

router = APIRouter(prefix="/api/v1", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        return await FinancialAgentService(get_settings()).chat(request.message, request.user_id)
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
