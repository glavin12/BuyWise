from __future__ import annotations

import uuid

import pytest

from ai_service.services.goal_service import GoalService
from ai_service.services.profile_service import ProfileService


@pytest.mark.asyncio
async def test_goal_progress_marks_goal_completed(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    service = GoalService(session)
    goal = await service.add_goal(user_id, title="Emergency", target_amount=10000)
    updated = await service.update_progress(
        user_id, goal_id=uuid.UUID(goal["id"]), current_amount=10000
    )
    assert updated["status"] == "completed"
    assert updated["progress_percent"] == 100
