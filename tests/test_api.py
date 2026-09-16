from __future__ import annotations

import pytest

from ai_service.services.profile_service import ProfileService


@pytest.mark.asyncio
async def test_categories_api_use_authenticated_owner(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    categories = await client.get("/api/v1/categories")
    assert categories.status_code == 200
    assert categories.json()["count"] == 36
