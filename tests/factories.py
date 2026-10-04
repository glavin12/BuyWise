from __future__ import annotations

import uuid
from contextlib import contextmanager

from sqlalchemy import event

from ai_service.models import Profile


@contextmanager
def count_statements(engine):
    """The SQL statements the engine runs inside the block, collected into a list."""
    statements: list[str] = []

    def record(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record)


async def create_profile(session, user_id: uuid.UUID | None = None) -> Profile:
    profile = Profile(id=user_id or uuid.uuid4())
    session.add(profile)
    await session.flush()
    return profile
