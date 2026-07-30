from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    """Incoming chat message from user."""

    message: str = Field(..., min_length=1, description="The user's message")
    conversation_id: Optional[str] = Field(
        None, description="Conversation ID. Auto-generated if not provided."
    )


class ToolCallInfo(BaseModel):
    """Info about a tool the agent called during processing."""

    tool_name: str
    tool_input: dict
    tool_output: str


class ChatResponse(BaseModel):
    """AI response returned to the user."""

    response: str
    conversation_id: str
    tool_calls: list[ToolCallInfo] = []
