"""Request-scoped context for tool execution.

LangChain tool functions are plain functions with no argument for ``user_id``
or the DB session. Tools need both to call services/repositories. We thread
them through ``contextvars`` — set by ``ChatService.send_message`` before
invoking the agent and cleared afterward. This keeps the agent's tool
signatures free of request plumbing and works correctly across asyncio tasks.
"""

from __future__ import annotations

import asyncio
import contextvars
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

_current_user_id: contextvars.ContextVar[uuid.UUID | None] = contextvars.ContextVar(
    "current_user_id", default=None
)
_current_db_session: contextvars.ContextVar[AsyncSession | None] = contextvars.ContextVar(
    "current_db_session", default=None
)


DEFAULT_TIMEZONE = "Asia/Kolkata"  # a new profile's timezone too


def _utc_now() -> datetime:
    """The one place the user's date is read from the clock; tests freeze it here."""
    return datetime.now(timezone.utc)


def local_date(zone_name: str | None) -> tuple[str, date]:
    """The timezone to use for a user and today's date there.

    A missing or unknown ``zone_name`` (the column is free text, and the server may lack the
    tz data) gives ``DEFAULT_TIMEZONE``, and UTC if even that is not installed.
    """
    for name in (zone_name, DEFAULT_TIMEZONE):
        try:
            return name, _utc_now().astimezone(ZoneInfo(name)).date()
        except (ZoneInfoNotFoundError, ValueError, TypeError, OSError):
            continue
    return "UTC", _utc_now().date()


@dataclass
class _Turn:
    """What the tools of one agent turn share: the user's date, the session's lock and a count of their writes."""

    turn_id: str | None
    today: date | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    writes: dict[str, int] = field(default_factory=dict)


_current_turn: contextvars.ContextVar[_Turn | None] = contextvars.ContextVar("current_turn", default=None)


@contextmanager
def request_context(
    user_id: uuid.UUID, session: AsyncSession, turn_id: str | None = None, today: date | None = None
):
    """Set the authenticated user + session for the duration of a request.

    Tools read these via :func:`get_current_user_id` / :func:`get_db_session`. ``turn_id`` names
    the chat turn (its user message), so a re-run of that turn gives its writes the same keys.
    ``today`` is the date in the user's timezone, which every "today" and "this month" in the
    turn means (:func:`get_today`).
    """
    user_token = _current_user_id.set(user_id)
    session_token = _current_db_session.set(session)
    turn_token = _current_turn.set(_Turn(turn_id, today))
    try:
        yield
    finally:
        _current_user_id.reset(user_token)
        _current_db_session.reset(session_token)
        _current_turn.reset(turn_token)


def tool_lock() -> asyncio.Lock:
    """The lock a tool holds while it runs, so the turn's tools use the one session in turn.

    LangGraph runs a step's tool calls concurrently, and an ``AsyncSession`` allows one operation
    at a time: a write's commit racing a read failed the whole turn.
    """
    turn = _current_turn.get()
    return turn.lock if turn is not None else asyncio.Lock()


def next_write_key(kind: str) -> str | None:
    """An idempotency key for this turn's next write of ``kind``, the same on every run of the turn.

    A failed chat send may be retried with its key, which re-runs the agent on the same user
    message. Its first transaction then gets the key of the first run's first transaction, so a
    transaction the failed run already saved is returned instead of saved twice. Counting, not
    hashing the arguments, keeps two identical expenses in one message apart. ``None`` outside a
    chat turn.
    """
    turn = _current_turn.get()
    if turn is None or turn.turn_id is None:
        return None
    turn.writes[kind] = count = turn.writes.get(kind, 0) + 1
    return f"chat:{turn.turn_id}:{kind}:{count}"


def get_today() -> date:
    """The user's date for this chat turn; the UTC date when the turn was given none."""
    turn = _current_turn.get()
    if turn is not None and turn.today is not None:
        return turn.today
    return _utc_now().date()


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
