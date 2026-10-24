"""One log line per request: how long it took and what it cost the database.

    request method=GET route=/api/v1/transactions status=200 ms=41.7 db_statements=2 db_ms=24.3 db_connects=0

``route`` is the matched path template, never the raw path, so no ID or query string reaches the log. Nothing
else from the request or the SQL (headers, bodies, parameters) is read. ``db_connects`` counts connections the
pool had to open during the request; a request that shows 1 paid for a new one (about 0.3 s to Supabase).
"""

from __future__ import annotations

import contextvars
import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

from sqlalchemy import event
from sqlalchemy.engine import ExceptionContext
from sqlalchemy.ext.asyncio import AsyncEngine
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


@dataclass
class DatabaseUse:
    statements: int = 0
    seconds: float = 0.0
    connects: int = 0


_current: contextvars.ContextVar[DatabaseUse | None] = contextvars.ContextVar("database_use", default=None)


@contextmanager
def track_database_use() -> Iterator[DatabaseUse]:
    """Count what the instrumented engines do inside the block, in this task and the ones it starts."""
    use = DatabaseUse()
    token = _current.set(use)
    try:
        yield use
    finally:
        _current.reset(token)


def instrument_engine(engine: AsyncEngine) -> None:
    sync_engine = engine.sync_engine

    def before_execute(connection, cursor, statement, parameters, context, executemany) -> None:
        context.started_at = time.perf_counter()
        use = _current.get()
        if use is not None:
            use.statements += 1

    def after_execute(connection, cursor, statement, parameters, context, executemany) -> None:
        add_seconds(context)

    def on_error(exception_context: ExceptionContext) -> None:
        # A statement that timed out is the one worth seeing, and it never reaches after_cursor_execute.
        add_seconds(exception_context.execution_context)

    def add_seconds(context) -> None:
        started_at = getattr(context, "started_at", None)
        use = _current.get()
        if started_at is not None and use is not None:
            use.seconds += time.perf_counter() - started_at
            context.started_at = None

    def on_connect(dbapi_connection, connection_record) -> None:
        use = _current.get()
        if use is not None:
            use.connects += 1

    event.listen(sync_engine, "before_cursor_execute", before_execute)
    event.listen(sync_engine, "after_cursor_execute", after_execute)
    event.listen(sync_engine, "handle_error", on_error)
    event.listen(sync_engine, "connect", on_connect)


class RequestLogMiddleware:
    """Pure ASGI, so the request and the database events share one context (no extra task, no body buffering)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] == "/health/live":
            await self.app(scope, receive, send)
            return

        status = 500  # an exception that reaches this point ends as the server's 500
        started = time.perf_counter()

        async def send_and_note_status(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        with track_database_use() as use:
            try:
                await self.app(scope, receive, send_and_note_status)
            finally:
                route = getattr(scope.get("route"), "path", None) or "unmatched"
                logger.info(
                    "request method=%s route=%s status=%d ms=%.1f db_statements=%d db_ms=%.1f db_connects=%d",
                    scope["method"],
                    route,
                    status,
                    (time.perf_counter() - started) * 1000,
                    use.statements,
                    use.seconds * 1000,
                    use.connects,
                )
