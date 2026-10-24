"""How the engine behaves when the network or the database stops answering.

The mobile app gives up on a request after 15 s, so every wait the engine can add must end sooner, and a pool
full of connections that a network change left half-dead must cost one slow request at most, not one per
connection. The fault-injection tests need PostgreSQL (see ``tests/postgres.py``).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid

import asyncpg
import pytest
from sqlalchemy import exc as sa_exc, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

import ai_service.db.session as session_module
from ai_service.core.observability import DatabaseUse, instrument_engine, track_database_use
from ai_service.db.session import DatabaseUnavailableError, build_engine
from ai_service.services.category_service import CategoryService
from tests.postgres import postgres_url

OBSERVABILITY_LOGGER = "ai_service.core.observability"


def test_engine_waits_end_before_the_clients_15_second_timeout(monkeypatch):
    captured: dict = {}
    real_create = session_module.create_async_engine

    def spy(url, **kwargs):
        captured.update(kwargs)
        return real_create(url, **kwargs)

    monkeypatch.setattr(session_module, "_engine", None)
    monkeypatch.setattr(session_module, "get_database_url", lambda: "postgresql+asyncpg://u:p@127.0.0.1:1/db")
    monkeypatch.setattr(session_module, "create_async_engine", spy)

    engine = session_module.get_engine()

    connect_args = captured["connect_args"]
    # asyncpg's own defaults are 60 s to connect and, in SQLAlchemy's pool, 30 s to wait for a free connection.
    assert (connect_args["timeout"], connect_args["command_timeout"], engine.pool.timeout()) == (10, 10, 10)


class FreezableProxy:
    """A TCP relay in front of PostgreSQL that can go silent on the connections it already carries.

    ``freeze()`` makes it swallow the bytes in both directions without closing a socket, which is what a dead
    Wi-Fi route looks like to the app: no error, no reply. Connections opened after the freeze are relayed
    normally, like the new route after a network change.
    """

    def __init__(self, host: str, port: int):
        self._target = (host, port)
        self._server: asyncio.Server | None = None
        self._open: list[tuple[asyncio.StreamWriter, asyncio.StreamWriter]] = []
        self._frozen_before = 0  # connections accepted before this count are frozen
        self.accepted = 0
        self.port = 0

    async def start(self) -> None:
        self._server = await asyncio.start_server(self._relay, "127.0.0.1", 0)
        self.port = self._server.sockets[0].getsockname()[1]

    def freeze(self) -> None:
        self._frozen_before = self.accepted

    async def stop(self) -> None:
        assert self._server is not None
        self._server.close()
        for writers in self._open:
            for writer in writers:
                writer.close()

    async def _relay(self, client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter) -> None:
        number = self.accepted
        self.accepted += 1
        server_reader, server_writer = await asyncio.open_connection(*self._target)
        self._open.append((client_writer, server_writer))

        async def pump(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, closes_both: bool) -> None:
            try:
                while data := await reader.read(65536):
                    if number < self._frozen_before:
                        continue
                    writer.write(data)
                    await writer.drain()
            except (ConnectionError, asyncio.CancelledError):
                pass
            finally:
                # The app closing its socket reaches the proxy even on a dead route (loopback), so free the
                # PostgreSQL backend; the server's side closing is swallowed while frozen.
                if closes_both or number >= self._frozen_before:
                    client_writer.close()
                    server_writer.close()

        await asyncio.gather(
            pump(client_reader, server_writer, closes_both=True),
            pump(server_reader, client_writer, closes_both=False),
        )


async def _query(engine: AsyncEngine) -> tuple[str, float, DatabaseUse]:
    """One request's database work: the outcome ("ok", the exception's name, or "hung"), its seconds, its cost."""
    started = time.perf_counter()
    with track_database_use() as use:
        # Before the fix a request on a dead connection never came back; a limit keeps a regression from
        # hanging the suite. Inside it, asyncpg's own TimeoutError is an ordinary failure; only the deadline's
        # reaches the outer handler.
        try:
            async with asyncio.timeout(10):
                try:
                    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                        await session.execute(text("select 1"))
                    outcome = "ok"
                except Exception as exc:
                    outcome = type(exc).__name__
        except TimeoutError:
            outcome = "hung"
    return outcome, time.perf_counter() - started, use


@contextlib.asynccontextmanager
async def _pool_behind_a_dead_route(pre_ping: bool):
    """A pool of 4 warm connections whose route has just gone silent, with short timeouts."""
    database = make_url(postgres_url())
    proxy = FreezableProxy(database.host, database.port)
    await proxy.start()
    url = database.set(host="127.0.0.1", port=proxy.port)
    engine = build_engine(
        url.render_as_string(hide_password=False),
        pre_ping=pre_ping,
        pool_size=4,
        command_timeout=1,
        connect_timeout=1,
        pool_timeout=1,
        ping_timeout=0.5,
    )
    try:
        warm = [await engine.connect() for _ in range(4)]
        for connection in warm:
            await connection.execute(text("select 1"))
        for connection in warm:
            await connection.close()
        proxy.freeze()
        yield engine
    finally:
        with contextlib.suppress(Exception, asyncio.CancelledError):
            async with asyncio.timeout(10):
                await engine.dispose()
        await proxy.stop()


@pytest.mark.parametrize("pre_ping", [True, False])
async def test_a_network_break_costs_at_most_one_request(pre_ping):
    """With every pooled connection dead, behind the ping the break costs one slow request and no failure;
    without the ping the first statement fails after its timeout (1 s here, 10 s in production) and the pool is
    discarded at once. Before the fix each of the 4 dead connections hung its request for good."""
    async with _pool_behind_a_dead_route(pre_ping) as engine:
        results = [await _query(engine) for _ in range(6)]
    summary = [(outcome, round(seconds, 2), use.connects) for outcome, seconds, use in results]

    failed = [outcome for outcome, _, _ in results if outcome != "ok"]
    assert len(failed) == (0 if pre_ping else 1), summary
    if not pre_ping:
        assert failed == ["TimeoutError"], summary
    assert max(seconds for _, seconds, _ in results) < 2, summary
    assert sum(seconds for _, seconds, _ in results[1:]) < 1, summary
    # The first request is the one that found the route down: the log line would show its reconnect or its
    # timed-out statement.
    first_use = results[0][2]
    if pre_ping:
        assert first_use.connects >= 1, summary
    else:
        assert (first_use.statements, first_use.seconds >= 0.9) == (1, True), summary


@pytest.mark.parametrize("pre_ping", [True, False])
async def test_a_request_cancelled_on_a_dead_connection_does_not_hang_the_pool(pre_ping):
    """The chat turn's 60 s limit cancels the tools' statements. asyncpg then waits for the server to answer the
    cancelled query before it will close the connection, which on a dead route is never."""
    async with _pool_behind_a_dead_route(pre_ping) as engine:
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(_query(engine), 0.2)
        results = [await _query(engine) for _ in range(4)]

    outcomes = [outcome for outcome, _, _ in results]
    # Without the ping one more statement finds another dead connection and fails once, as above.
    assert "hung" not in outcomes and outcomes.count("ok") >= (4 if pre_ping else 3), outcomes


@pytest.mark.parametrize("pre_ping", [True, False])
async def test_a_connection_the_server_dropped_is_replaced(pre_ping):
    engine = build_engine(postgres_url(), pre_ping=pre_ping, pool_size=2)
    try:
        async with engine.connect() as connection:
            pid = (await connection.execute(text("select pg_backend_pid()"))).scalar_one()
        dsn = make_url(postgres_url()).set(drivername="postgresql").render_as_string(hide_password=False)
        admin = await asyncpg.connect(dsn)
        try:
            await admin.execute(f"select pg_terminate_backend({pid})")
        finally:
            await admin.close()
        await asyncio.sleep(0.2)

        first, _, _ = await _query(engine)
        second, _, _ = await _query(engine)

        # Behind the ping the dropped connection is swapped before the request uses it.
        assert (first, second) == ("ok" if pre_ping else "DatabaseUnavailableError", "ok")
    finally:
        await engine.dispose()


# What the app does with a database outage that reaches a route.


@pytest.mark.parametrize(
    "error",
    [
        TimeoutError(),
        ConnectionRefusedError("10.0.0.7:5432 refused"),
        sa_exc.TimeoutError("QueuePool limit of size 10 overflow 5 reached"),
        DatabaseUnavailableError("The database connection dropped"),
    ],
    ids=["command-timeout", "refused", "pool-wait", "dropped"],
)
async def test_a_database_outage_answers_503_with_retry_after(api_client, monkeypatch, error):
    client, _ = api_client

    async def fail(*args, **kwargs):
        raise error

    monkeypatch.setattr(CategoryService, "list_categories", fail)

    response = await client.get("/api/v1/categories")

    assert response.status_code == 503
    assert response.headers["retry-after"] == "2"
    # Generic: nothing of the driver's message (hosts, SQL) goes to the client.
    assert response.json() == {"detail": "The service is temporarily unavailable. Please try again."}


# Request observability.


def _logged(caplog) -> list[str]:
    return [record.getMessage() for record in caplog.records if record.name == OBSERVABILITY_LOGGER]


def _request_lines(caplog) -> list[dict[str, str]]:
    return [dict(pair.split("=", 1) for pair in message.removeprefix("request ").split()) for message in _logged(caplog)]


async def test_each_request_logs_its_route_status_and_database_cost(engine, api_client, caplog):
    client, _ = api_client
    instrument_engine(engine)
    caplog.set_level(logging.INFO, logger=OBSERVABILITY_LOGGER)
    missing = uuid.uuid4()

    await client.get("/api/v1/categories", params={"type": "expense"})
    await client.get(f"/api/v1/transactions/{missing}")
    await client.get("/health/live")

    lines = _request_lines(caplog)
    assert [(line["method"], line["route"], line["status"]) for line in lines] == [
        ("GET", "/api/v1/categories", "200"),
        ("GET", "/api/v1/transactions/{transaction_id}", "404"),
    ]
    assert int(lines[0]["db_statements"]) >= 1
    assert float(lines[0]["ms"]) >= float(lines[0]["db_ms"]) > 0
    assert lines[0]["db_connects"] == "0"
    # Neither the raw path nor the query string is logged.
    assert str(missing) not in " ".join(_logged(caplog))
    assert "expense" not in " ".join(_logged(caplog))


async def test_an_unhandled_error_is_logged_as_a_500_without_its_message(api_client, monkeypatch, caplog):
    client, _ = api_client
    caplog.set_level(logging.INFO, logger=OBSERVABILITY_LOGGER)

    async def fail(*args, **kwargs):
        raise RuntimeError("balance is 123456")

    monkeypatch.setattr(CategoryService, "list_categories", fail)

    with pytest.raises(RuntimeError):
        await client.get("/api/v1/categories")

    assert [(line["route"], line["status"]) for line in _request_lines(caplog)] == [("/api/v1/categories", "500")]
    assert "123456" not in " ".join(_logged(caplog))


async def test_database_use_counts_statements_time_and_new_connections(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'use.db'}")
    instrument_engine(engine)

    async def one_statement():
        async with engine.connect() as connection:
            await connection.execute(text("select 1"))

    try:
        with track_database_use() as use:
            await asyncio.gather(one_statement(), one_statement())
        await one_statement()  # outside a request: not counted anywhere
    finally:
        await engine.dispose()

    assert (use.statements, use.connects) == (2, 2)
    assert use.seconds > 0
