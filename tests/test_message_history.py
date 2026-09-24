from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from ai_service.models import MessageRole
from ai_service.repositories.messages import MessageCreate, MessageRepository


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
