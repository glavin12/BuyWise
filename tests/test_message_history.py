from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy import select

import ai_service.services.chat_service as chat_service
from ai_service.models import Message, MessageRole, MessageStatus
from ai_service.repositories.messages import MessageCreate, MessageRepository
from ai_service.services.conversation_service import ConversationService
from ai_service.utils.langchain_messages import db_messages_to_langchain


async def test_history_returns_the_newest_page_in_order_and_cursor_pages_back(session):
    repo = MessageRepository(session)
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for n in range(5):
        row, _ = await repo.create(
            MessageCreate(conversation_id=conversation_id, user_id=user_id, role=MessageRole.USER, content=str(n))
        )
        row.created_at = start + timedelta(minutes=n)
    await session.flush()

    newest = await repo.load_all(conversation_id, user_id, limit=3)
    assert [m.content for m in newest] == ["2", "3", "4"]

    older = await repo.load_all(conversation_id, user_id, cursor=newest[0].created_at, limit=3)
    assert [m.content for m in older] == ["0", "1"]


async def test_chat_saves_only_dialogue_and_replays_write_effects(api_client, session, monkeypatch):
    client, user_id = api_client
    seen = []

    async def agent(messages):
        seen.append(messages)
        if len(seen) == 1:
            return {"messages": [
                *messages,
                AIMessage(content="", tool_calls=[{
                    "name": "update_goal_progress", "args": {"goal_id": "test", "current_amount": 20}, "id": "call-1"
                }]),
                ToolMessage(content='{"display_current_amount":20}', tool_call_id="call-1"),
                AIMessage(content="Goal corrected."),
            ]}
        return {"messages": [*messages, AIMessage(content="Done.")]}

    monkeypatch.setattr(chat_service, "invoke_agent", agent)
    body = {"message": "Correct my goal", "idempotency_key": "goal-correction"}
    first = (await client.post("/api/v1/chat", json=body)).json()
    replay = (await client.post("/api/v1/chat", json=body)).json()
    rows = (await session.scalars(
        select(Message).where(Message.user_id == user_id).order_by(Message.created_at, Message.id)
    )).all()

    assert first["tool_calls"][0]["tool_name"] == "update_goal_progress"
    assert first["changed_resources"] == replay["changed_resources"] == ["goal"]
    assert replay["tool_calls"] == []
    assert len(seen) == 1  # replay did not run the agent again
    assert [row.role for row in rows] == [MessageRole.USER, MessageRole.ASSISTANT]
    assert rows[1].tool_calls is None
    assert rows[1].message_metadata == {"changed_resources": ["goal"]}

    await client.post("/api/v1/chat", json={"message": "What next?", "conversation_id": first["conversation_id"]})
    assert [message.content for message in seen[1][1:]] == ["Correct my goal", "Goal corrected.", "What next?"]
    assert all(not isinstance(message, ToolMessage) for message in seen[1])


async def test_recent_context_skips_legacy_tool_rows_before_applying_limit(session):
    repo = MessageRepository(session)
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    rows = [
        (MessageRole.USER, "Old question", None),
        (MessageRole.ASSISTANT, "Old answer", None),
        (MessageRole.USER, "New question", None),
    ]
    for n in range(25):
        rows.extend([
            (MessageRole.ASSISTANT, "", [{"name": "get_dashboard", "id": str(n)}]),
            (MessageRole.TOOL, "Old tool result", None),
        ])
    rows.append((MessageRole.ASSISTANT, "New answer", None))
    for role, content, tool_calls in rows:
        await repo.create(MessageCreate(
            conversation_id=conversation_id, user_id=user_id, role=role,
            content=content, tool_calls=tool_calls,
        ))
    await session.flush()

    recent = await repo.load_recent(conversation_id, user_id, limit=3)
    assert [message.content for message in recent] == ["Old answer", "New question", "New answer"]
    assert [message.content for message in db_messages_to_langchain(recent)] == ["Old answer", "New question", "New answer"]


async def test_replay_of_legacy_turn_still_reports_changed_data(session):
    repo = MessageRepository(session)
    conversation_id, user_id = uuid.uuid4(), uuid.uuid4()
    user_message, _ = await repo.create(MessageCreate(
        conversation_id=conversation_id, user_id=user_id, role=MessageRole.USER,
        content="Log lunch", status=MessageStatus.COMPLETED,
    ))
    await repo.create(MessageCreate(
        conversation_id=conversation_id, user_id=user_id, role=MessageRole.ASSISTANT,
        content="", tool_calls=[{"name": "add_transaction", "id": "old-call"}],
        status=MessageStatus.COMPLETED,
    ))
    await repo.create(MessageCreate(
        conversation_id=conversation_id, user_id=user_id, role=MessageRole.ASSISTANT,
        content="Lunch logged.", status=MessageStatus.COMPLETED,
    ))
    await session.flush()

    replay = await ConversationService(session).replay(user_message)
    assert replay is not None
    assert replay.changed_resources == ["transaction", "payee"]
    assert replay.tool_calls == []
