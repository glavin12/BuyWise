from __future__ import annotations

import uuid

import pytest

from ai_service.core.context import request_context
from ai_service.services.goal_service import GoalService
from ai_service.services.profile_service import ProfileService
from ai_service.tools.goals import get_financial_goals, update_goal_progress, update_goal_target


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


@pytest.mark.asyncio
async def test_ai_can_correct_an_achieved_goals_saved_or_target_amount(session):
    user_id = uuid.uuid4()
    await ProfileService(session).create_profile(user_id)
    goal = await GoalService(session).add_goal(
        user_id, title="Laptop", target_amount=6000, current_amount=6000
    )

    with request_context(user_id, session):
        achieved = await get_financial_goals.ainvoke({"status": "completed"})
        corrected_saved = await update_goal_progress.ainvoke(
            {"goal_id": goal["id"], "current_amount": 20}
        )
        await update_goal_progress.ainvoke({"goal_id": goal["id"], "current_amount": 60})
        corrected_target = await update_goal_target.ainvoke(
            {"goal_id": goal["id"], "target_amount": 100}
        )
        active = await get_financial_goals.ainvoke({"status": "active"})

    assert achieved["goals"][0]["id"] == goal["id"]
    assert corrected_saved["status"] == "active"
    assert corrected_saved["display_current_amount"] == 20.0
    assert corrected_target["status"] == "active"
    assert corrected_target["display_target_amount"] == 100.0
    assert active["goals"][0]["id"] == goal["id"]


@pytest.mark.asyncio
async def test_ai_cannot_change_another_users_achieved_goal(session):
    owner = uuid.uuid4()
    await ProfileService(session).create_profile(owner)
    goal = await GoalService(session).add_goal(owner, title="Laptop", target_amount=6000, current_amount=6000)

    with request_context(uuid.uuid4(), session):
        result = await update_goal_target.ainvoke({"goal_id": goal["id"], "target_amount": 100})

    assert result["status"] == "error"
    assert (await GoalService(session).list_goals(owner, status="completed"))["count"] == 1
