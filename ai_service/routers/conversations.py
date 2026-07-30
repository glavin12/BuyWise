from fastapi import APIRouter, HTTPException

from ai_service.schemas.conversation import ConversationHistory
from ai_service.services.conversation_service import conversation_service

router = APIRouter(prefix="/api/v1", tags=["conversations"])


@router.get("/conversations/{conversation_id}/messages", response_model=ConversationHistory)
async def get_conversation_messages(conversation_id: str):
    """Get all messages for a conversation."""
    return conversation_service.get_conversation(conversation_id)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation and its message history."""
    deleted = conversation_service.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "conversation_id": conversation_id}
