"""Deployment boundaries: busy chats must not save messages or block ordinary requests."""

import asyncio
import ssl

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from ai_service.core.capacity import ChatCapacity
from ai_service.core.config import Settings
from ai_service.core.rate_limit import limiter
from ai_service.db import session as db_session
from ai_service.routers import chat as chat_router


@pytest.mark.parametrize("field,value", [
    ("DB_POOL_SIZE", 0), ("DB_MAX_OVERFLOW", -1), ("CHAT_MAX_CONCURRENT", 0),
])
def test_invalid_capacity_settings_fail(field, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


async def test_capacity_released_after_error_and_cancellation():
    capacity = ChatCapacity(1)
    for failure in (RuntimeError, asyncio.CancelledError):
        with pytest.raises(failure):
            async with capacity.slot():
                with pytest.raises(HTTPException) as busy:
                    async with capacity.slot():
                        pytest.fail("An excess chat was admitted")
                assert busy.value.status_code == 503
                raise failure()
        assert capacity.active == 0
    async with capacity.slot():
        assert capacity.active == 1


async def test_busy_chat_rejected_before_service_and_crud_still_answers(api_client, monkeypatch):
    client, _ = api_client
    capacity = ChatCapacity(1)
    entered = asyncio.Event()
    finish = asyncio.Event()
    calls = []

    async def send(service, **kwargs):
        calls.append(kwargs)
        entered.set()
        await finish.wait()
        return {"response": "done", "conversation_id": "00000000-0000-0000-0000-000000000001", "tool_calls": []}

    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(chat_router, "chat_capacity", capacity)
    monkeypatch.setattr(chat_router.ChatService, "send_message", send)
    pending = asyncio.create_task(client.post("/api/v1/chat", json={"message": "hello"}))
    try:
        await asyncio.wait_for(entered.wait(), timeout=2)
        rejected = await client.post("/api/v1/chat", json={"message": "another"})
        assert rejected.status_code == 503
        assert rejected.headers["Retry-After"] == "5"
        assert len(calls) == 1
        assert (await client.get("/api/v1/categories")).status_code == 200
    finally:
        finish.set()
        await pending
    assert capacity.active == 0


def test_remote_pool_settings_and_verified_tls_reach_driver(monkeypatch):
    captured = {}
    real_create = db_session.create_async_engine

    def spy(url, **kwargs):
        captured.update(kwargs)
        return real_create(url, **kwargs)

    monkeypatch.setattr(db_session, "create_async_engine", spy)
    settings = Settings(_env_file=None, DB_POOL_SIZE=3, DB_MAX_OVERFLOW=1, DB_SSL_VERIFY=True)
    monkeypatch.setattr(db_session, "get_settings", lambda: settings)
    monkeypatch.setattr(db_session, "get_database_url", lambda: "postgresql+asyncpg://u:p@127.0.0.1/db")
    monkeypatch.setattr(db_session, "_engine", None)
    engine = db_session.get_engine()
    assert engine.pool.size() == 3
    assert captured["max_overflow"] == 1
    context = captured["connect_args"]["ssl"]
    assert context.check_hostname
    assert context.verify_mode == ssl.CERT_REQUIRED
