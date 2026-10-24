from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ai_service.core.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


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


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        # Home fires 5 requests at once, a full default pool (5): with 10 kept, a bigger burst does not reconnect.
        # ponytail: 10 + 5 overflow keeps the old ceiling of 15 connections per process; with several workers,
        # keep workers x 15 within the pooler's pool size (Supabase > Database settings).
        # A connection opened on an earlier network (Wi-Fi change, sleep) can go half-dead: no error, just
        # retransmits, and the ping hangs on it too. pool_recycle replaces every connection within 5 minutes,
        # and command_timeout makes a statement on a dead one fail in 10 s (under the app's 15 s) instead of hanging.
        _engine = create_async_engine(
            get_database_url(),
            pool_pre_ping=get_settings().DB_POOL_PRE_PING,
            pool_size=10,
            max_overflow=5,
            pool_recycle=300,
            connect_args={"command_timeout": 10},
        )
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
