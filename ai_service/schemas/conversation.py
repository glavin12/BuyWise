from pydantic import BaseModel
from datetime import datetime


class Message(BaseModel):
    """A single message in a conversation."""

    role: str  # "user", "assistant", "tool"
    content: str
    timestamp: datetime


class ConversationHistory(BaseModel):
    """Full conversation history for a conversation ID."""

    conversation_id: str
    messages: list[Message] = []
