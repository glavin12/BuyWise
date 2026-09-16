from __future__ import annotations

import pytest
import uuid

from ai_service.core.context import request_context
from ai_service.tools.categories import get_categories
from ai_service.tools.dashboard import get_dashboard
from ai_service.services.profile_service import ProfileService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_ai_tools_use_user_scoped_context(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    with request_context(user_id, session):
        categories = await get_categories.ainvoke({})
        dashboard = await get_dashboard.ainvoke({})
    assert categories["count"] == 36
    assert dashboard["currency"] == "INR"
