import asyncio
import contextlib
import time
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.engine import ExceptionContext
from sqlalchemy.exc import InvalidatePoolError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ai_service.core.config import get_settings
from ai_service.core.observability import instrument_engine

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None

# Seconds; the waits stay under the mobile app's 15 s request timeout. The ping gets 3 because a healthy
# connection answers it in one round trip (about 20 ms): one that has not answered after 3 s is not coming back.
COMMAND_TIMEOUT = 10
CONNECT_TIMEOUT = 10
POOL_TIMEOUT = 10
PING_TIMEOUT = 3
POOL_SIZE = 10
MAX_OVERFLOW = 5
POOL_RECYCLE = 300


def get_database_url() -> str:
    """Return an async SQLAlchemy database URL from environment settings."""
    settings = get_settings()
    url = settings.DATABASE_URL or settings.SUPABASE_DATABASE_URL
    if not url:
        raise RuntimeError("DATABASE_URL or SUPABASE_DATABASE_URL must be configured")

    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class DatabaseUnavailableError(Exception):
    """The database connection dropped under a statement; the caller may try again (HTTP 503)."""


def _drop_socket(connection) -> None:
    """Close a pooled connection's socket now, without a goodbye.

    SQLAlchemy discards a connection by asking asyncpg to close it politely, and after a timeout or a
    cancellation asyncpg first waits, with no limit, for the server to answer the query it cancelled. On a
    dead route that answer never comes, so the request would hang for good holding its pool slot.
    """
    driver_connection = connection.driver_connection
    if driver_connection is not None:
        driver_connection.terminate()


def _guard_pool(engine: AsyncEngine, *, pre_ping: bool, ping_timeout: float) -> None:
    """Make a pool whose connections went dead (Wi-Fi change, sleep) cost one slow request, not one per connection."""
    sync_engine = engine.sync_engine
    route_down_at = 0.0

    def route_is_down() -> None:
        # Every connection opened before now is dead too: the pool discards them as they come up for checkout.
        nonlocal route_down_at
        route_down_at = time.time()

    def on_error(context: ExceptionContext) -> DatabaseUnavailableError | None:
        error = context.original_exception
        if isinstance(error, (asyncio.TimeoutError, asyncio.CancelledError)) and context.connection is not None:
            with contextlib.suppress(Exception):  # best effort: the error being handled is what matters
                _drop_socket(context.connection.connection)
        if isinstance(error, asyncio.TimeoutError):
            # SQLAlchemy discards only the connection that timed out, and the next 9 requests would each wait
            # their own 10 s on the others.
            route_is_down()
            context.invalidate_pool_on_disconnect = True
        if context.is_disconnect and context.sqlalchemy_exception is not None:
            return DatabaseUnavailableError("The database connection dropped")
        return None

    def on_close(dbapi_connection, connection_record) -> None:
        # Saying goodbye to a dead connection means waiting 2 s for a hang-up that never comes.
        if connection_record.last_connect_time < route_down_at:
            _drop_socket(dbapi_connection)

    event.listen(sync_engine, "handle_error", on_error)
    event.listen(sync_engine, "close", on_close)

    if pre_ping:
        # SQLAlchemy's own ping (pool_pre_ping) runs BEGIN, a query and ROLLBACK, each waiting the full
        # command_timeout, and a ping that times out is not seen as a dead connection: the request fails.
        # This one is a single simple query with a short limit, and a failure rebuilds the whole pool
        # inside the same checkout, so the request that finds the route down is slow but succeeds.
        @event.listens_for(sync_engine, "checkout")
        def ping(dbapi_connection, connection_record, connection_proxy) -> None:
            try:
                dbapi_connection.run_async(lambda connection: connection.execute("SELECT 1", timeout=ping_timeout))
            except BaseException as error:
                _drop_socket(connection_proxy)
                if isinstance(error, Exception):
                    route_is_down()
                    raise InvalidatePoolError("The pooled connection did not answer its ping") from error
                raise


def build_engine(
    url: str,
    *,
    pre_ping: bool,
    command_timeout: float = COMMAND_TIMEOUT,
    connect_timeout: float = CONNECT_TIMEOUT,
    pool_timeout: float = POOL_TIMEOUT,
    ping_timeout: float = PING_TIMEOUT,
    pool_size: int = POOL_SIZE,
    max_overflow: int = MAX_OVERFLOW,
) -> AsyncEngine:
    """The engine for ``url``: ``get_engine`` uses the defaults, the fault-injection tests shorter timeouts."""
    # Home fires 5 requests at once, a full default pool (5): with 10 kept, a bigger burst does not reconnect.
    # ponytail: 10 + 5 overflow keeps the old ceiling of 15 connections per process; with several workers,
    # keep workers x 15 within the pooler's pool size (Supabase > Database settings).
    # The app gives up on a request after 15 s, so no wait here may reach that: asyncpg's own defaults are
    # 60 s to connect and SQLAlchemy's 30 s for a free pooled connection, both now 10 s, like command_timeout.
    # A connection opened on an earlier network (Wi-Fi change, sleep) can go half-dead: no error, just
    # retransmits. pool_recycle replaces every connection within 5 minutes, command_timeout makes a statement on
    # a dead one fail in 10 s (under the app's 15 s) instead of hanging, and _guard_pool makes that failure, or a
    # failed ping, discard all the dead connections together. SQLAlchemy's own pool_pre_ping is left off for it.
    engine = create_async_engine(
        url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_recycle=POOL_RECYCLE,
        pool_timeout=pool_timeout,
        connect_args={"command_timeout": command_timeout, "timeout": connect_timeout},
    )
    _guard_pool(engine, pre_ping=pre_ping, ping_timeout=ping_timeout)
    instrument_engine(engine)
    return engine


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = build_engine(get_database_url(), pre_ping=get_settings().DB_POOL_PRE_PING)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
        )
    return _session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
