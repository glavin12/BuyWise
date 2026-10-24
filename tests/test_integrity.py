"""Schema integrity: the ORM models match the migrations, and writes stay correct under concurrency.

Tests that need PostgreSQL itself are opt-in (``TEST_POSTGRES_URL``, see tests/postgres.py). They build their own
database from the real migrations, so a model that drifts from them, or a constraint the SQLite suite never sees,
shows up here.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy import delete, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ai_service.models import BudgetEntry, Category, Conversation, Message, MessageRole, Payee
from ai_service.repositories import CategoryRepository, PayeeRepository
from ai_service.services.budget_service import BudgetService
from ai_service.services.category_service import CategoryService
from ai_service.services.profile_service import ProfileService
from tests.factories import count_statements
from tests.postgres import postgres_url

ROOT = Path(__file__).resolve().parent.parent


def _plain(url) -> str:
    """The URL as asyncpg and the Alembic CLI take it (no driver suffix, password kept)."""
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    # DATABASE_URL beats whatever .env holds, so the migrations only ever touch the throwaway database.
    env = {**os.environ, "DATABASE_URL": database_url}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120
    )


async def _admin(url, statement: str) -> None:
    connection = await asyncpg.connect(_plain(url))
    try:
        await connection.execute(statement)
    finally:
        await connection.close()


@pytest.fixture(scope="module")
def migrated_url():
    """A fresh database at the Alembic head, as an ``postgresql+asyncpg`` URL; dropped afterwards."""
    base = make_url(postgres_url())
    name = f"integrity_{uuid.uuid4().hex[:10]}"
    asyncio.run(_admin(base, f'create database "{name}"'))
    migrated = base.set(database=name)
    try:
        upgraded = _alembic(_plain(migrated), "upgrade", "head")
        assert upgraded.returncode == 0, upgraded.stderr
        yield migrated.render_as_string(hide_password=False)
    finally:
        asyncio.run(_admin(base, f'drop database if exists "{name}" with (force)'))


def test_the_models_match_the_migrated_schema(migrated_url):
    """`alembic check` proposes nothing, so a future `--autogenerate` has no destructive operations to write."""
    checked = _alembic(_plain(make_url(migrated_url)), "check")
    assert checked.returncode == 0, checked.stderr[-3000:]


# --- F6: a budget save is one upsert ------------------------------------------------------------------------------

R = 100  # one rupee in minor units


async def _profile_with_food(session) -> tuple[uuid.UUID, uuid.UUID]:
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    return user_id, (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id


async def test_saving_a_budget_is_the_category_read_and_one_upsert(engine, session):
    user_id, food = await _profile_with_food(session)
    service = BudgetService(session)

    with count_statements(engine) as first_save:
        created = await service.set_budget(user_id, category_id=food, month=10, year=2026, budgeted_amount=100 * R)
    with count_statements(engine) as second_save:
        updated = await service.set_budget(user_id, category_id=food, month=10, year=2026, budgeted_amount=250 * R)

    assert len(first_save) == len(second_save) == 2  # the category, then INSERT ... ON CONFLICT DO UPDATE
    assert created["id"] == updated["id"]
    assert (created["category"], created["budgeted_amount"]) == ("Food", 100 * R)
    assert (updated["category"], updated["budgeted_amount"], updated["display_budgeted_amount"]) == ("Food", 250 * R, 250.0)
    rows = list(await session.scalars(select(BudgetEntry).where(BudgetEntry.user_id == user_id)))
    assert [row.budgeted_amount for row in rows] == [250 * R]  # one row, and the session's copy of it is current


async def test_a_budget_save_bumps_updated_at_and_keeps_created_at(session):
    user_id, food = await _profile_with_food(session)
    service = BudgetService(session)
    await service.set_budget(user_id, category_id=food, month=10, year=2026, budgeted_amount=100 * R)
    entry = await session.scalar(select(BudgetEntry).where(BudgetEntry.user_id == user_id))
    created_at = entry.created_at
    await session.execute(update(BudgetEntry).values(updated_at=datetime(2020, 1, 1)))  # make "now" distinguishable
    await session.commit()

    await service.set_budget(user_id, category_id=food, month=10, year=2026, budgeted_amount=300 * R)

    await session.refresh(entry)
    assert entry.created_at == created_at
    assert entry.updated_at.year >= 2026


@pytest_asyncio.fixture
async def pg_factory(migrated_url):
    """Sessions on the migrated database; the pool is wide enough for every concurrent save below."""
    engine = create_async_engine(migrated_url, pool_size=30)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


async def _pg_user(factory, *, defaults: bool = False) -> uuid.UUID:
    """A committed user: the auth.users row the profile references, the profile, and one expense category."""
    user_id = uuid.uuid4()
    async with factory() as session:
        await session.execute(text("insert into auth.users (id) values (:id)"), {"id": user_id})
        if defaults:
            await ProfileService(session).create_profile(user_id)
        else:
            await ProfileService(session).profiles.create(user_id)
            await CategoryRepository(session).create(user_id, name="Food", type="expense")
            await session.commit()
    return user_id


async def test_concurrent_first_saves_of_one_budget_both_succeed(pg_factory):
    """Two requests set the same category and month for the first time. Read-then-insert made the loser hit the
    unique constraint (a 409 for a save that should simply win or lose); an upsert lets both through."""
    user_id = await _pg_user(pg_factory)
    async with pg_factory() as session:
        food = (await CategoryRepository(session).find_by_name(user_id, "Food", "expense")).id

    async def save(month: int, rupees: int):
        async with pg_factory() as session:
            return await BudgetService(session).set_budget(
                user_id, category_id=food, month=month, year=2026, budgeted_amount=rupees * R
            )

    months = range(1, 13)  # twelve independent races, so one lucky interleaving cannot hide the bug
    results = await asyncio.gather(
        *(save(month, rupees) for month in months for rupees in (100, 200)), return_exceptions=True
    )

    assert [result for result in results if isinstance(result, Exception)] == []
    async with pg_factory() as session:
        rows = list(await session.scalars(select(BudgetEntry).where(BudgetEntry.user_id == user_id)))
    assert sorted(row.month for row in rows) == list(months)  # one row per month
    assert {row.budgeted_amount for row in rows} <= {100 * R, 200 * R}  # whichever save landed last
    for result in results:
        assert result["category"] == "Food"


async def test_messages_keep_their_json_columns_in_jsonb(pg_factory):
    user_id = await _pg_user(pg_factory)
    calls = [{"name": "get_dashboard", "args": {"period": "this_month"}, "id": "call-1"}]
    async with pg_factory() as session:
        conversation = Conversation(user_id=user_id)
        session.add(conversation)
        await session.flush()
        session.add(
            Message(
                conversation_id=conversation.id,
                user_id=user_id,
                role=MessageRole.ASSISTANT,
                content="",
                tool_calls=calls,
                message_metadata={"model": "test", "nested": {"ok": True}},
            )
        )
        await session.commit()

    async with pg_factory() as session:
        message = await session.scalar(select(Message).where(Message.user_id == user_id))
        types = (
            await session.execute(
                text(
                    "select column_name, data_type from information_schema.columns "
                    "where table_name = 'messages' and column_name in ('tool_calls', 'metadata')"
                )
            )
        ).all()
    assert (message.tool_calls, message.message_metadata) == (calls, {"model": "test", "nested": {"ok": True}})
    assert dict(types) == {"tool_calls": "jsonb", "metadata": "jsonb"}


# --- F8: an archived category's name can be used again ------------------------------------------------------------


async def _api_user(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    return client, user_id


async def test_creating_a_category_with_an_archived_ones_name_brings_it_back(api_client, session):
    client, _ = await _api_user(api_client, session)
    hobbies = (await client.post("/api/v1/categories", json={"name": "Hobbies", "type": "expense"})).json()
    assert (await client.delete(f"/api/v1/categories/{hobbies['id']}")).status_code == 200

    again = await client.post("/api/v1/categories", json={"name": "Hobbies", "type": "expense"})

    assert again.status_code == 200
    assert (again.json()["id"], again.json()["is_active"]) == (hobbies["id"], True)  # the same row, so its history stays
    listed = (await client.get("/api/v1/categories")).json()["categories"]
    assert [c["id"] for c in listed if c["name"] == "Hobbies"] == [hobbies["id"]]


async def test_a_brought_back_category_takes_the_new_icon_and_colour_and_keeps_the_rest(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    service = CategoryService(session)
    old = await service.create_category(user_id, name="Hobbies", type="expense", icon="old-icon", color="#111111")
    await service.delete_category(user_id, uuid.UUID(old["id"]))

    only_icon = await service.create_category(user_id, name="Hobbies", type="expense", icon="new-icon")

    assert (only_icon["icon"], only_icon["color"]) == ("new-icon", "#111111")  # what was not sent stays

    await service.delete_category(user_id, uuid.UUID(old["id"]))
    both = await service.create_category(user_id, name="Hobbies", type="expense", icon="newer", color="#222222")
    assert (both["icon"], both["color"], both["is_active"]) == ("newer", "#222222", True)


async def test_an_archived_name_is_matched_the_way_active_names_are(session):
    """Lookups ignore case and surrounding spaces while the unique constraint does not, so "hobbies" must find the
    archived "Hobbies" instead of inserting a second row; the type still has to match."""
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    service = CategoryService(session)
    hobbies = await service.create_category(user_id, name="Hobbies", type="expense")
    await service.delete_category(user_id, uuid.UUID(hobbies["id"]))

    income = await service.create_category(user_id, name="Hobbies", type="income")
    assert income["id"] != hobbies["id"]  # an expense category's name does not block an income one

    again = await service.create_category(user_id, name="  hOBBIES ", type="expense")
    assert (again["id"], again["name"], again["is_active"]) == (hobbies["id"], "Hobbies", True)


async def test_an_active_category_is_still_returned_as_it_is(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    service = CategoryService(session)
    hobbies = await service.create_category(user_id, name="Hobbies", type="expense", icon="a")

    again = await service.create_category(user_id, name="hobbies", type="expense", icon="b")

    assert again == hobbies  # no icon change on an active row: the request is a lookup, as before


async def test_renaming_a_category_to_an_archived_ones_name_is_a_conflict(api_client, session):
    """Unlike creating, a rename cannot take the archived row back: that would merge two categories' histories under
    one name, so the unique constraint's 409 stands."""
    client, _ = await _api_user(api_client, session)
    old = (await client.post("/api/v1/categories", json={"name": "Hobbies", "type": "expense"})).json()
    await client.delete(f"/api/v1/categories/{old['id']}")
    other = (await client.post("/api/v1/categories", json={"name": "Crafts", "type": "expense"})).json()

    renamed = await client.patch(f"/api/v1/categories/{other['id']}", json={"name": "Hobbies"})

    assert renamed.status_code == 409


async def test_the_same_works_on_postgresql(pg_factory):
    user_id = await _pg_user(pg_factory, defaults=True)
    async with pg_factory() as session:
        service = CategoryService(session)
        hobbies = await service.create_category(user_id, name="Hobbies", type="expense")
        await service.delete_category(user_id, uuid.UUID(hobbies["id"]))
        again = await service.create_category(user_id, name="hobbies", type="expense")
    assert (again["id"], again["is_active"]) == (hobbies["id"], True)


# --- F11: first login seeds the defaults in a handful of statements -----------------------------------------------


async def test_first_login_seeds_36_categories_and_36_payees_in_a_handful_of_statements(engine, session):
    """A probe counted 76 statements (73 INSERTs, one per row) for the first GET /profile."""
    user_id = uuid.uuid4()

    with count_statements(engine) as statements:
        await ProfileService(session).create_profile(user_id)

    inserts = [statement for statement in statements if statement.startswith("INSERT")]
    assert len(inserts) == 3  # the profile, its categories, its payees
    assert len(statements) == 5  # plus a read of what exists before each seeding
    assert len(await CategoryRepository(session).list(user_id)) == 36
    assert len(await PayeeRepository(session).list(user_id)) == 36


async def test_seeding_adds_only_what_is_missing(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    categories, payees = CategoryRepository(session), PayeeRepository(session)
    food = await categories.find_by_name(user_id, "Food", "expense")
    await categories.delete(user_id, food.id)  # archived rows count as present: the unique constraint covers them
    await session.execute(delete(Category).where(Category.user_id == user_id, Category.name == "Fuel"))
    await session.execute(delete(Payee).where(Payee.user_id == user_id, Payee.name == "Uber"))
    await session.commit()

    new_categories = await categories.seed_defaults(user_id)
    new_payees = await payees.seed_defaults(user_id)

    assert [category.name for category in new_categories] == ["Fuel"]
    assert [payee.name for payee in new_payees] == ["Uber"]
    assert (new_categories[0].icon, new_categories[0].color, new_categories[0].is_active) == ("fuel", "#DC2626", True)
    assert new_categories[0].created_at is not None  # loaded with the insert: reading it later must not query
    assert await categories.seed_defaults(user_id) == [] and await payees.seed_defaults(user_id) == []
    assert len(await categories.list(user_id, active_only=False)) == 36
    assert len(await payees.list(user_id)) == 36


async def test_first_login_seeding_on_postgresql_is_batched_too(pg_factory):
    user_id = uuid.uuid4()
    async with pg_factory() as session:
        await session.execute(text("insert into auth.users (id) values (:id)"), {"id": user_id})
        with count_statements(session.bind) as statements:
            await ProfileService(session).create_profile(user_id)
        categories = await CategoryRepository(session).list(user_id)
        payees = await PayeeRepository(session).list(user_id)

    assert len([statement for statement in statements if statement.startswith("INSERT")]) == 3
    assert (len(categories), len(payees)) == (36, 36)
