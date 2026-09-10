from __future__ import annotations

import pytest

from ai_service.services.profile_service import ProfileService


@pytest.mark.asyncio
async def test_categories_and_accounts_api_use_authenticated_owner(api_client, session):
    client, user_id = api_client
    await ProfileService(session).create_profile(user_id)
    categories = await client.get("/api/v1/categories")
    accounts = await client.get("/api/v1/accounts")
    assert categories.status_code == 200
    assert categories.json()["count"] == 20
    assert accounts.status_code == 200
    assert accounts.json()["accounts"][0]["name"] == "Cash"


@pytest.mark.asyncio
async def test_account_create_bootstraps_a_user_without_a_profile(api_client):
    client, _ = api_client

    response = await client.post(
        "/api/v1/accounts",
        json={"name": "Savings", "account_type": "savings"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Savings"
