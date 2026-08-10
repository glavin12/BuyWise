from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Goal
from ai_service.repositories import CategoryRepository, GoalRepository
from ai_service.utils.financial import days_remaining_in_month, minor_to_amount


class GoalNotFoundError(LookupError):
    pass


class GoalService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.goals = GoalRepository(session)
        self.categories = CategoryRepository(session)

    async def list_goals(self, user_id: uuid.UUID, *, status: str = "active") -> dict:
        rows = await self.goals.list(user_id, status=status)
        return {"status": status, "count": len(rows), "goals": [self._goal_to_dict(goal) for goal in rows]}

    async def add_goal(
        self,
        user_id: uuid.UUID,
        *,
        title: str,
        target_amount: int,
        category_id: uuid.UUID | None = None,
        goal_type: str | None = None,
        description: str | None = None,
        priority: str | None = None,
        target_date: date | None = None,
        current_amount: int = 0,
    ) -> dict:
        if not title or not title.strip():
            raise ValueError("title is required")
        if target_amount <= 0 or current_amount < 0:
            raise ValueError("goal amounts are invalid")
        if category_id is not None:
            category = await self.categories.get(user_id, category_id)
            if category is None or not category.is_active:
                raise ValueError("category not found")
        goal = await self.goals.create(
            user_id,
            title=title.strip(),
            target_amount=target_amount,
            current_amount=current_amount,
            category_id=category_id,
            goal_type=goal_type,
            description=description,
            priority=priority,
            target_date=target_date,
            status="completed" if current_amount >= target_amount else "active",
        )
        await self.session.commit()
        return self._goal_to_dict(goal)

    async def update_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID, **fields) -> dict:
        if "current_amount" in fields and fields["current_amount"] < 0:
            raise ValueError("current_amount must be non-negative")
        if "target_amount" in fields and fields["target_amount"] <= 0:
            raise ValueError("target_amount must be positive")
        if "category_id" in fields and fields["category_id"] is not None:
            category = await self.categories.get(user_id, fields["category_id"])
            if category is None or not category.is_active:
                raise ValueError("category not found")
        goal = await self.goals.update(user_id, goal_id, **fields)
        if goal is None:
            raise GoalNotFoundError("Goal not found")
        await self.session.commit()
        return self._goal_to_dict(goal)

    async def update_progress(
        self, user_id: uuid.UUID, *, goal_id: uuid.UUID, current_amount: int
    ) -> dict:
        return await self.update_goal(user_id, goal_id, current_amount=current_amount)

    def _goal_to_dict(self, goal: Goal) -> dict:
        remaining = max(goal.target_amount - goal.current_amount, 0)
        progress = round(goal.current_amount * 100 / goal.target_amount, 1) if goal.target_amount else 0
        monthly_needed = self._monthly_needed(goal)
        return {
            "id": str(goal.id),
            "title": goal.title,
            "description": goal.description,
            "category_id": str(goal.category_id) if goal.category_id else None,
            "category": goal.category.name if goal.category else None,
            "goal_type": goal.goal_type,
            "priority": goal.priority,
            "target_amount": goal.target_amount,
            "display_target_amount": minor_to_amount(goal.target_amount),
            "current_amount": goal.current_amount,
            "display_current_amount": minor_to_amount(goal.current_amount),
            "progress_percent": progress,
            "remaining_amount": remaining,
            "display_remaining_amount": minor_to_amount(remaining),
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "monthly_needed_to_hit_target": monthly_needed,
            "display_monthly_needed_to_hit_target": minor_to_amount(monthly_needed)
            if monthly_needed is not None
            else None,
            "days_remaining_in_month": days_remaining_in_month(),
            "status": goal.status,
        }

    @staticmethod
    def _monthly_needed(goal: Goal) -> int | None:
        if goal.target_date is None:
            return None
        today = date.today()
        if goal.target_date <= today:
            return None
        months_left = (goal.target_date.year - today.year) * 12 + goal.target_date.month - today.month
        if months_left <= 0:
            return None
        return max(goal.target_amount - goal.current_amount, 0) // months_left
