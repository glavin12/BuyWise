from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Conversation


class ConversationRepository:
    """Database access for conversations.

    Every read/write is scoped to ``user_id``: this is the access-control
    boundary (see AGENTS.md Phase 1 spec, section 11). RLS is not relied on.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, title: str | None = None) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        self.session.add(conversation)
        await self.session.flush()
        return conversation

    async def get(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Conversation | None:
        return await self.session.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
        )

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        cursor: datetime | None = None,
        limit: int = 50,
    ) -> list[Conversation]:
        stmt = select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.deleted_at.is_(None),
        )
        if cursor is not None:
            stmt = stmt.where(Conversation.updated_at < cursor)
        stmt = stmt.order_by(
            Conversation.updated_at.desc(),
            Conversation.id.desc(),
        ).limit(limit)
        result = await self.session.scalars(stmt)
        return list(result)

    async def soft_delete(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        result = await self.session.execute(
            update(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
            .values(deleted_at=func.now())
        )
        return bool(result.rowcount)

    async def touch(self, conversation_id: uuid.UUID, increment: int = 1) -> None:
        await self.session.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(
                message_count=Conversation.message_count + increment,
                last_message_at=func.now(),
                updated_at=func.now(),
            )
        )
