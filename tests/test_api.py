from __future__ import annotations

from datetime import datetime, timezone

import pytest

from ai_service.services.profile_service import ProfileService


@pytest.mark.asyncio
async def test_categories_api_use_authenticated_owner(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    categories = await client.get("/api/v1/categories")
    assert categories.status_code == 200
    assert categories.json()["count"] == 36


@pytest.mark.asyncio
async def test_dashboard_resolves_the_month_from_the_callers_date(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)

    october = (await client.get("/api/v1/dashboard", params={"today": "2026-10-01"})).json()
    assert (october["month"], october["year"]) == ("October", 2026)

    # The caller is still on 30 September while the server's UTC clock may already say October.
    september = (await client.get("/api/v1/dashboard", params={"today": "2026-09-30"})).json()
    assert september["month"] == "September"
    assert september["days_remaining_in_month"] == 0

    december = (await client.get("/api/v1/dashboard", params={"period": "last_month", "today": "2026-01-15"})).json()
    assert (december["month"], december["year"]) == ("December", 2025)


@pytest.mark.asyncio
async def test_dashboard_without_a_date_keeps_using_the_server_date(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)

    now = datetime.now(timezone.utc)
    body = (await client.get("/api/v1/dashboard")).json()
    assert (body["month"], body["year"]) == (now.strftime("%B"), now.year)


@pytest.mark.asyncio
async def test_dashboard_rejects_a_date_it_cannot_use(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)

    assert (await client.get("/api/v1/dashboard", params={"today": "1999-01-01"})).status_code == 400
    assert (await client.get("/api/v1/dashboard", params={"today": "tomorrow"})).status_code == 422


@pytest.mark.asyncio
async def test_bodies_of_a_kilobyte_or_more_are_gzipped_for_clients_that_accept_it(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)

    categories = await client.get("/api/v1/categories", headers={"Accept-Encoding": "gzip"})  # 36 rows, about 7 KB
    assert categories.headers["content-encoding"] == "gzip"
    assert categories.json()["count"] == 36  # httpx unpacks it, as React Native's fetch does

    profile = await client.get("/api/v1/profile", headers={"Accept-Encoding": "gzip"})  # about 300 bytes
    assert profile.status_code == 200
    assert "content-encoding" not in profile.headers
