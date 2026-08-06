from __future__ import annotations

import logging
import uuid

from langchain_core.messages import AIMessage
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context import ContextManager
from ai_service.core.config import get_settings
from ai_service.core.context import request_context
from ai_service.models import generate_uuid7
from ai_service.schemas.chat import ChatResponse
from ai_service.services.agent_service import extract_agent_output, invoke_agent
from ai_service.services.conversation_service import (
    ConversationNotFoundError,
    ConversationService,
)

logger = logging.getLogger(__name__)


class ChatService:
    """Orchestrates the persisted chat flow."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.conversations = ConversationService(session)
        self.context_mgr = ContextManager(session)

    async def send_message(
        self,
        message: str,
        user_id: uuid.UUID,
        conversation_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
    ) -> ChatResponse:
        # Exactly-once: replay a prior completed send for this key.
        if idempotency_key is not None:
            prior = await self.conversations.get_idempotent_result(
                user_id, idempotency_key
            )
            if prior is not None:
                return prior
        else:
            idempotency_key = str(generate_uuid7())

        # Resolve the conversation (new or existing, user-scoped).
        if conversation_id is None:
            conversation = await self.conversations.create_conversation(user_id=user_id)
            conversation_id = conversation.id
        else:
            conversation = await self.conversations.get_conversation(
                conversation_id, user_id
            )
            if conversation is None:
                raise ConversationNotFoundError("Conversation not found")

        await self.conversations.save_user_message(
            conversation_id=conversation_id,
            user_id=user_id,
            content=message,
            idempotency_key=idempotency_key,
        )

        settings = get_settings()
        recent = await self.conversations.get_recent_messages(
            conversation_id=conversation_id,
            user_id=user_id,
            limit=settings.MAX_CONVERSATION_HISTORY,
        )

        ctx = await self.context_mgr.build_context(user_id, conversation_id)
        context_messages = ctx.to_langchain_messages()
        all_messages = context_messages + recent

        try:
            with request_context(user_id, self.session):
                result = await invoke_agent(all_messages)
            final_ai, tool_exchanges, tool_calls = extract_agent_output(
                result, input_count=len(all_messages)
            )
            await self.conversations.save_assistant_turn(
                conversation_id=conversation_id,
                user_id=user_id,
                ai_message=final_ai,
                tool_exchanges=tool_exchanges,
            )
            response = (
                final_ai.content if isinstance(final_ai.content, str) else str(final_ai.content)
            )
        except Exception:
            logger.exception("Agent execution failed")
            response = (
                "I'm sorry, I encountered an error processing your request. Please try again."
            )
            await self.conversations.save_assistant_turn(
                conversation_id=conversation_id,
                user_id=user_id,
                ai_message=AIMessage(content=response),
                error={"message": "agent execution failed"},
            )
            tool_calls = []

        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            tool_calls=tool_calls,
        )
