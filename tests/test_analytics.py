from __future__ import annotations

from datetime import date

import pytest

from ai_service.services.analytics_service import AnalyticsService
from tests.factories import create_profile


@pytest.mark.asyncio
async def test_empty_month_comparison_is_zero_without_division_error(session):
    user_id = (await create_profile(session)).id
    await session.commit()
    result = await AnalyticsService(session).month_comparison(
        user_id, date.today().month, date.today().year, date.today().month, date.today().year
    )
    assert result["change"]["income"]["percent"] is None
