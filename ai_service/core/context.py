"""Request-scoped context for tool execution.

LangChain tool functions are plain functions with no argument for ``user_id``
or the DB session. Tools need both to call services/repositories. We thread
them through ``contextvars`` — set by ``ChatService.send_message`` before
invoking the agent and cleared afterward. This keeps the agent's tool
signatures free of request plumbing and works correctly across asyncio tasks.
"""

from __future__ import annotations

import contextvars
import uuid
from contextlib import contextmanager

from sqlalchemy.ext.asyncio import AsyncSession

_current_user_id: contextvars.ContextVar[uuid.UUID | None] = contextvars.ContextVar(
    "current_user_id", default=None
)
_current_db_session: contextvars.ContextVar[AsyncSession | None] = contextvars.ContextVar(
    "current_db_session", default=None
)


@contextmanager
def request_context(user_id: uuid.UUID, session: AsyncSession):
    """Set the authenticated user + session for the duration of a request.

    Tools read these via :func:`get_current_user_id` / :func:`get_db_session`.
    """
    user_token = _current_user_id.set(user_id)
    session_token = _current_db_session.set(session)
    try:
        yield
    finally:
        _current_user_id.reset(user_token)
        _current_db_session.reset(session_token)


def get_current_user_id() -> uuid.UUID:
    """Return the authenticated user id for the current request."""
    user_id = _current_user_id.get()
    if user_id is None:
        raise RuntimeError("No active user context. Tools must run inside request_context().")
    return user_id


def get_db_session() -> AsyncSession:
    """Return the DB session for the current request."""
    session = _current_db_session.get()
    if session is None:
        raise RuntimeError("No active DB session. Tools must run inside request_context().")
    return session
