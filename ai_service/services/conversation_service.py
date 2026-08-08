from __future__ import annotations

import uuid
from datetime import datetime

from langchain_core.messages import AIMessage, BaseMessage
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Conversation, Message, MessageRole, MessageStatus
from ai_service.repositories import ConversationRepository, MessageRepository
from ai_service.repositories.messages import MessageCreate
from ai_service.schemas.chat import ChatResponse, ToolCallInfo
from ai_service.services.agent_service import ToolExchange
from ai_service.utils.langchain_messages import db_messages_to_langchain


class ConversationNotFoundError(LookupError):
    """Raised when a requested conversation does not exist for the user."""


class ConversationService:
    """Coordinates short-term conversation persistence.

    All access is scoped by ``user_id`` at the repository layer (AGENTS.md Phase 1
    spec, section 11); RLS is not relied upon.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.conversations = ConversationRepository(session)
        self.messages = MessageRepository(session)

    async def create_conversation(self, user_id: uuid.UUID) -> Conversation:
        conversation = await self.conversations.create(user_id=user_id)
        await self.session.commit()
        return conversation

    async def ensure_title(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
    ) -> None:
        """Derive a title from the first user message if none exists yet.

        The title is set exactly once, from the first message of the
        conversation, so it stays recognizable in the conversation list.
        """
        conversation = await self.conversations.get(conversation_id, user_id)
        if conversation is None or conversation.title:
            return
        title = _derive_title(content)
        if title:
            await self.conversations.set_title(conversation_id, user_id, title)
            await self.session.commit()

    async def get_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Conversation | None:
        return await self.conversations.get(conversation_id, user_id)

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        cursor: datetime | None = None,
        limit: int = 50,
    ) -> list[Conversation]:
        return await self.conversations.list_for_user(user_id, cursor=cursor, limit=limit)

    async def soft_delete_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        deleted = await self.conversations.soft_delete(conversation_id, user_id)
        await self.session.commit()
        return deleted

    async def save_user_message(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        idempotency_key: str,
    ) -> Message:
        message = await self.messages.create(
            MessageCreate(
                conversation_id=conversation_id,
                user_id=user_id,
                role=MessageRole.USER,
                content=content,
                status=MessageStatus.COMPLETED,
                idempotency_key=idempotency_key,
            )
        )
        await self.conversations.touch(conversation_id)
        await self.session.commit()
        return message

    async def save_assistant_turn(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        ai_message: AIMessage | None = None,
        tool_exchanges: list[ToolExchange] | None = None,
        error: dict | None = None,
    ) -> list[Message]:
        """Persist one agent turn, atomically.

        On success: each intermediate assistant(tool_calls) row followed by its
        tool result rows, then the final assistant text row — in order, so a
        reload reconstructs the exact sequence the model produced.
        On failure (``error`` set): a single ``status=failed`` assistant row.
        """
        saved: list[Message] = []

        if error is not None:
            content = "I'm sorry, I encountered an error processing your request. Please try again."
            if ai_message is not None and ai_message.content:
                content = _as_text(ai_message.content)
            saved.append(
                await self.messages.create(
                    MessageCreate(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        role=MessageRole.ASSISTANT,
                        content=content,
                        status=MessageStatus.FAILED,
                        message_metadata=error,
                    )
                )
            )
        else:
            for exchange in tool_exchanges or []:
                tool_ai = exchange.ai_message
                saved.append(
                    await self.messages.create(
                        MessageCreate(
                            conversation_id=conversation_id,
                            user_id=user_id,
                            role=MessageRole.ASSISTANT,
                            content=_as_text(tool_ai.content) if tool_ai.content else "",
                            tool_calls=[
                                {
                                    "name": tc.get("name"),
                                    "args": tc.get("args", {}),
                                    "id": tc.get("id"),
                                }
                                for tc in tool_ai.tool_calls
                            ],
                            status=MessageStatus.COMPLETED,
                        )
                    )
                )
                for tool_message in exchange.tool_messages:
                    saved.append(
                        await self.messages.create(
                            MessageCreate(
                                conversation_id=conversation_id,
                                user_id=user_id,
                                role=MessageRole.TOOL,
                                content=str(tool_message.content),
                                tool_call_id=tool_message.tool_call_id,
                                status=MessageStatus.COMPLETED,
                            )
                        )
                    )

            content = _as_text(ai_message.content) if ai_message is not None else ""
            usage: dict = {}
            if ai_message is not None:
                usage = getattr(ai_message, "usage_metadata", None) or {}
            saved.append(
                await self.messages.create(
                    MessageCreate(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        role=MessageRole.ASSISTANT,
                        content=content,
                        status=MessageStatus.COMPLETED,
                        prompt_tokens=usage.get("input_tokens"),
                        completion_tokens=usage.get("output_tokens"),
                        total_tokens=usage.get("total_tokens"),
                    )
                )
            )

        await self.conversations.touch(conversation_id, increment=len(saved))
        await self.session.commit()
        return saved

    async def get_recent_messages(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int,
    ) -> list[BaseMessage]:
        """Most recent messages, converted to agent-ready LangChain messages."""
        rows = await self.messages.load_recent(conversation_id, user_id, limit)
        return db_messages_to_langchain(rows)

    async def get_full_history(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        cursor: datetime | None = None,
        limit: int = 100,
    ) -> list[Message]:
        """Chronological raw rows for UI display. Never fed to the agent."""
        conversation = await self.conversations.get(conversation_id, user_id)
        if conversation is None:
            raise ConversationNotFoundError("Conversation not found")
        return await self.messages.load_all(conversation_id, user_id, cursor=cursor, limit=limit)

    async def get_idempotent_result(
        self,
        user_id: uuid.UUID,
        idempotency_key: str,
    ) -> ChatResponse | None:
        """Replay a previously completed send, if one exists for this key."""
        user_message = await self.messages.get_by_idempotency_key(user_id, idempotency_key)
        if user_message is None:
            return None

        history = await self.messages.load_all(user_message.conversation_id, user_id)
        index = next(
            (i for i, m in enumerate(history) if m.id == user_message.id),
            None,
        )
        if index is None:
            return None

        # Only this send's turn: the rows after the user message, up to the next
        # user message.
        turn: list[Message] = []
        for row in history[index + 1 :]:
            if row.role == MessageRole.USER:
                break
            turn.append(row)
        if not turn:
            return None

        final = None
        for row in reversed(turn):
            if row.role == MessageRole.ASSISTANT:
                final = row
                break
        if final is None:
            return None
        # Exactly-once applies to completed sends only. A failed turn (e.g. an
        # agent error) must be retryable with the same key — replaying it would
        # return the apology forever.
        if final.status != MessageStatus.COMPLETED:
            return None

        tool_calls: list[ToolCallInfo] = []
        for row in turn:
            if row.role == MessageRole.ASSISTANT and row.tool_calls:
                for tc in row.tool_calls:
                    tool_calls.append(
                        ToolCallInfo(
                            tool_name=tc.get("name", ""),
                            tool_input=tc.get("args", {}),
                            tool_output="",
                        )
                    )
            elif row.role == MessageRole.TOOL:
                for info in reversed(tool_calls):
                    if not info.tool_output:
                        info.tool_output = str(row.content)
                        break

        return ChatResponse(
            response=final.content,
            conversation_id=final.conversation_id,
            tool_calls=tool_calls,
        )


def _as_text(content: object) -> str:
    if isinstance(content, str):
        return content
    return str(content)


def _derive_title(content: str, max_chars: int = 60) -> str:
    """Collapse whitespace and truncate a message into a conversation title."""
    normalized = " ".join(content.split())
    if not normalized:
        return ""
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 1].rstrip() + "…"
