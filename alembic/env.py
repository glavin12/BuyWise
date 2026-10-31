from __future__ import annotations

from logging.config import fileConfig
import ssl

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from ai_service.db.base import Base
from ai_service.core.config import get_settings
from ai_service.db.session import get_database_url
from ai_service import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    """Leave out the foreign keys into Supabase's ``auth`` schema.

    ``profiles.id`` and ``conversations.user_id`` reference ``auth.users.id`` in the database. The models cannot
    declare that (the SQLite tests have no ``auth`` schema), so without this every ``alembic check`` or
    ``--autogenerate`` would propose dropping both keys.
    """
    if type_ == "foreign_key_constraint" and reflected:
        return obj.referred_table.schema != "auth"
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=get_database_url(),
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"ssl": ssl.create_default_context()} if get_settings().DB_SSL_VERIFY else {},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(
            lambda sync_connection: context.configure(
                connection=sync_connection,
                target_metadata=target_metadata,
                include_object=include_object,
            )
        )

        async with connection.begin():
            await connection.run_sync(lambda _: context.run_migrations())

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio

    asyncio.run(run_migrations_online())
