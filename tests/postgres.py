"""Opt-in PostgreSQL tests.

The default suite runs on in-memory SQLite. Tests that need PostgreSQL itself (its constraints, ON CONFLICT,
asyncpg's timeouts, a real connection pool) call :func:`postgres_url` and are skipped unless
``TEST_POSTGRES_URL`` names a throwaway database, which they may fill and empty. Never point it at Supabase.

A local one, with the stand-ins for Supabase's ``auth`` schema and roles that the migrations reference:

    podman run -d --rm --name buywise-pg-test -p 127.0.0.1:55432:5432 \\
        -e POSTGRES_PASSWORD=buywise_test docker.io/library/postgres:16-alpine
    podman exec -i buywise-pg-test psql -U postgres -d template1 <<'SQL'
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role anon; create role authenticated; create role service_role;
    SQL
    podman exec buywise-pg-test psql -U postgres -c "create database buywise_test"
    TEST_POSTGRES_URL=postgresql+asyncpg://postgres:buywise_test@127.0.0.1:55432/buywise_test uv run pytest tests
"""

from __future__ import annotations

import os

import pytest


def postgres_url() -> str:
    """The throwaway database's URL, or skip the calling test when none is configured."""
    url = os.environ.get("TEST_POSTGRES_URL", "")
    if not url:
        pytest.skip("TEST_POSTGRES_URL is not set")
    return url
