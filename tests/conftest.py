from __future__ import annotations

from collections.abc import AsyncIterator
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ai_service.db.base import Base
import ai_service.models  # noqa: F401
from ai_service.auth import CurrentUser, get_current_user
from ai_service.db.session import get_async_session
from ai_service.main import app


@pytest_asyncio.fixture
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest_asyncio.fixture
async def api_client(session) -> AsyncIterator[tuple[AsyncClient, uuid.UUID]]:
    user_id = uuid.uuid4()

    async def override_session():
        yield session

    async def override_user():
        return CurrentUser(id=user_id, role="authenticated")

    app.dependency_overrides[get_async_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, user_id
    app.dependency_overrides.clear()
