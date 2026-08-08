from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Goal
from ai_service.repositories import GoalRepository
from ai_service.utils.financial import days_remaining_in_month


class GoalNotFoundError(LookupError):
    """Raised when a goal does not exist for the user."""


class GoalService:
    """Business logic for financial goals."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.goals = GoalRepository(session)

    async def list_goals(
        self,
        user_id: uuid.UUID,
        *,
        status: str = "active",
    ) -> dict:
        """Tool-facing goals list with progress metrics."""
        rows = await self.goals.list(user_id, status=status)
        return {
            "status": status,
            "count": len(rows),
            "goals": [self._goal_to_dict(g) for g in rows],
        }

    async def add_goal(
        self,
        user_id: uuid.UUID,
        *,
        title: str,
        target_amount: float,
        goal_type: str | None = None,
        description: str | None = None,
        priority: str | None = None,
        target_date: date | None = None,
    ) -> dict:
        if not title or not title.strip():
            raise ValueError("title is required")
        if target_amount <= 0:
            raise ValueError("target_amount must be positive")

        goal = await self.goals.create(
            user_id,
            title=title.strip(),
            target_amount=target_amount,
            goal_type=goal_type,
            description=description,
            priority=priority,
            target_date=target_date,
        )
        await self.session.commit()
        return self._goal_to_dict(goal)

    async def update_progress(
        self,
        user_id: uuid.UUID,
        *,
        goal_id: uuid.UUID,
        current_amount: float,
    ) -> dict:
        if current_amount < 0:
            raise ValueError("current_amount must be non-negative")
        goal = await self.goals.update_amount(user_id, goal_id, current_amount)
        if goal is None:
            raise GoalNotFoundError("Goal not found")
        await self.session.commit()
        return self._goal_to_dict(goal)

    def _goal_to_dict(self, g: Goal) -> dict:
        progress_percent = (
            round((float(g.current_amount) / float(g.target_amount)) * 100, 1)
            if g.target_amount
            else 0
        )
        monthly_needed = self._monthly_needed(g)
        return {
            "id": str(g.id),
            "title": g.title,
            "description": g.description,
            "goal_type": g.goal_type,
            "priority": g.priority,
            "target_amount": float(g.target_amount),
            "current_amount": float(g.current_amount),
            "progress_percent": progress_percent,
            "remaining_amount": round(float(g.target_amount) - float(g.current_amount), 2),
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "monthly_needed_to_hit_target": monthly_needed,
            "days_remaining_in_month": days_remaining_in_month(),
            "status": g.status,
        }

    @staticmethod
    def _monthly_needed(g: Goal) -> float | None:
        """Required per-month contribution to hit target by its date.

        Returns ``None`` when there is no target date or it has already passed.
        """
        if g.target_date is None:
            return None
        today = date.today()
        if g.target_date <= today:
            return None
        months_left = (g.target_date.year - today.year) * 12 + (
            g.target_date.month - today.month
        )
        if months_left <= 0:
            return None
        remaining = float(g.target_amount) - float(g.current_amount)
        if remaining <= 0:
            return 0.0
        return round(remaining / months_left, 2)
