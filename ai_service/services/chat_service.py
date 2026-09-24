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
    MessageInProgressError,
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
        user_message = None
        if idempotency_key is None:
            idempotency_key = str(generate_uuid7())
        else:
            user_message = await self.conversations.get_by_idempotency_key(
                user_id, idempotency_key
            )
            if user_message is not None:
                # Exactly-once: replay a completed send, refuse while it is still
                # running (MessageInProgressError), or fall through to retry a
                # failed one on the same message and conversation.
                prior = await self.conversations.replay(user_message)
                if prior is not None:
                    return prior
                conversation_id = user_message.conversation_id

        # Resolve the conversation (new or existing, user-scoped).
        if conversation_id is None:
            conversation = await self.conversations.create_conversation(user_id=user_id)
            conversation_id = conversation.id
        elif await self.conversations.get_conversation(conversation_id, user_id) is None:
            raise ConversationNotFoundError("Conversation not found")

        if user_message is None:
            _, created = await self.conversations.save_user_message(
                conversation_id=conversation_id,
                user_id=user_id,
                content=message,
                idempotency_key=idempotency_key,
            )
            if not created:
                # A concurrent send with this key won the insert and is running.
                # ponytail: losing this race leaves one empty conversation when
                # the client sent no conversation_id; clean up if it ever shows.
                raise MessageInProgressError("Still processing this message")
        await self.conversations.ensure_title(
            conversation_id=conversation_id,
            user_id=user_id,
            content=message,
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
            final_ai, tool_exchanges, tool_calls, reasoning = extract_agent_output(
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
            # A tool's DB work may have failed mid-transaction, leaving the
            # session unusable: reset it so the failure turn can be saved. The
            # user message is already committed and survives.
            await self.session.rollback()
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
            reasoning = None

        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            tool_calls=tool_calls,
            reasoning=reasoning,
        )
