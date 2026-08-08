from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    """Create a conversation for a user.

    The authenticated user is derived from the verified JWT (see
    ``get_current_user``); this body carries no ``user_id``.
    """

    title: str | None = None


class ConversationRead(BaseModel):
    """Conversation metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str | None
    message_count: int = 0
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class Message(BaseModel):
    """A single message in a conversation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_call_id: str | None = None
    status: Literal["pending", "completed", "failed"] = "completed"
    created_at: datetime


class ConversationHistory(BaseModel):
    """Full conversation history for a conversation ID."""

    conversation_id: UUID
    messages: list[Message] = Field(default_factory=list)
