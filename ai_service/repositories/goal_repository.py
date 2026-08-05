from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Goal


class GoalRepository:
    """Database access for financial goals. Scoped by ``profile_id``."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(
        self,
        profile_id: uuid.UUID,
        status: str | None = None,
    ) -> list[Goal]:
        stmt = select(Goal).where(Goal.profile_id == profile_id)
        if status is not None:
            stmt = stmt.where(Goal.status == status)
        stmt = stmt.order_by(Goal.created_at.asc(), Goal.id.asc())
        result = await self.session.scalars(stmt)
        return list(result)

    async def get(
        self,
        profile_id: uuid.UUID,
        goal_id: uuid.UUID,
    ) -> Goal | None:
        return await self.session.scalar(
            select(Goal).where(
                Goal.id == goal_id,
                Goal.profile_id == profile_id,
            )
        )

    async def create(
        self,
        profile_id: uuid.UUID,
        *,
        title: str,
        target_amount: float,
        goal_type: str | None = None,
        description: str | None = None,
        priority: str | None = None,
        target_date=None,
        current_amount: float = 0,
    ) -> Goal:
        goal = Goal(
            profile_id=profile_id,
            title=title,
            target_amount=target_amount,
            current_amount=current_amount,
            goal_type=goal_type,
            description=description,
            priority=priority,
            target_date=target_date,
        )
        self.session.add(goal)
        await self.session.flush()
        return goal

    async def update_amount(
        self,
        profile_id: uuid.UUID,
        goal_id: uuid.UUID,
        current_amount: float,
    ) -> Goal | None:
        goal = await self.get(profile_id, goal_id)
        if goal is None:
            return None
        goal.current_amount = current_amount
        if goal.status != "completed" and current_amount >= goal.target_amount:
            goal.status = "completed"
        await self.session.flush()
        return goal

    async def count_active(self, profile_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Goal)
            .where(Goal.profile_id == profile_id, Goal.status == "active")
        )
        return int(await self.session.scalar(stmt) or 0)
