from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Message, MessageRole, MessageStatus


@dataclass
class MessageCreate:
    """Internal create payload for a message row (not an API schema)."""

    conversation_id: uuid.UUID
    user_id: uuid.UUID
    role: MessageRole
    content: str
    tool_call_id: str | None = None
    tool_calls: list | None = None
    status: MessageStatus = MessageStatus.PENDING
    idempotency_key: str | None = None
    message_metadata: dict | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class MessageRepository:
    """Database access for conversation messages."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, message: MessageCreate) -> Message:
        """Insert a message, enforcing idempotency via the unique index.

        A conflicting idempotency_key (e.g. a concurrent retry) is caught by the
        unique index rather than a check-then-insert; the existing row is returned.
        """
        row = Message(
            conversation_id=message.conversation_id,
            user_id=message.user_id,
            role=message.role,
            content=message.content,
            tool_call_id=message.tool_call_id,
            tool_calls=message.tool_calls,
            status=message.status,
            idempotency_key=message.idempotency_key,
            message_metadata=message.message_metadata,
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            total_tokens=message.total_tokens,
        )
        self.session.add(row)
        try:
            async with self.session.begin_nested():
                await self.session.flush()
        except IntegrityError:
            existing = await self.get_by_idempotency_key(
                message.user_id, message.idempotency_key
            )
            if existing is not None:
                return existing
            raise
        return row

    async def get_by_idempotency_key(
        self,
        user_id: uuid.UUID,
        idempotency_key: str,
    ) -> Message | None:
        return await self.session.scalar(
            select(Message).where(
                Message.user_id == user_id,
                Message.idempotency_key == idempotency_key,
                Message.deleted_at.is_(None),
            )
        )

    async def load_recent(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int,
    ) -> list[Message]:
        """Most recent ``limit`` messages, returned in chronological order."""
        result = await self.session.scalars(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.user_id == user_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
        )
        return list(reversed(list(result)))

    async def load_all(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        cursor: datetime | None = None,
        limit: int = 100,
    ) -> list[Message]:
        """Chronological page of messages for UI display."""
        stmt = select(Message).where(
            Message.conversation_id == conversation_id,
            Message.user_id == user_id,
            Message.deleted_at.is_(None),
        )
        if cursor is not None:
            stmt = stmt.where(Message.created_at < cursor)
        stmt = stmt.order_by(Message.created_at.asc(), Message.id.asc()).limit(limit)
        result = await self.session.scalars(stmt)
        return list(result)

    async def update_status(
        self,
        message_id: uuid.UUID,
        status: MessageStatus,
        metadata: dict | None = None,
    ) -> None:
        values: dict = {"status": status}
        if metadata is not None:
            values["message_metadata"] = metadata
        await self.session.execute(
            update(Message).where(Message.id == message_id).values(**values)
        )
