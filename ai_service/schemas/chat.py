from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _empty_str_to_none(value: object) -> object:
    """Treat blank strings from form/UI clients as missing values."""
    if isinstance(value, str) and not value.strip():
        return None
    return value


class ChatRequest(BaseModel):
    """Incoming chat message from user."""

    message: str = Field(..., min_length=1, description="The user's message")
    user_id: UUID = Field(..., description="The authenticated user's ID.")
    conversation_id: UUID | None = Field(
        None, description="Conversation ID. Auto-generated if not provided."
    )
    idempotency_key: str | None = Field(
        None,
        description="Client-generated key for exactly-once sends. If a send with "
        "this key already completed, its prior result is returned instead.",
    )

    @field_validator("user_id", "conversation_id", "idempotency_key", mode="before")
    @classmethod
    def _normalize_blank_values(cls, value: object) -> object:
        return _empty_str_to_none(value)


class ToolCallInfo(BaseModel):
    """Info about a tool the agent called during processing."""

    tool_name: str
    tool_input: dict
    tool_output: str


class ChatResponse(BaseModel):
    """AI response returned to the user."""

    response: str
    conversation_id: UUID
    tool_calls: list[ToolCallInfo] = Field(default_factory=list)
