from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_service.models import Goal


class GoalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, user_id: uuid.UUID, status: str | None = None) -> list[Goal]:
        stmt = select(Goal).options(selectinload(Goal.category)).where(Goal.user_id == user_id)
        if status is not None:
            stmt = stmt.where(Goal.status == status)
        result = await self.session.scalars(stmt.order_by(Goal.created_at.asc(), Goal.id.asc()))
        return list(result)

    async def get(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> Goal | None:
        return await self.session.scalar(
            select(Goal)
            .options(selectinload(Goal.category))
            .where(Goal.id == goal_id, Goal.user_id == user_id)
        )

    async def create(self, user_id: uuid.UUID, **fields) -> Goal:
        goal = Goal(user_id=user_id, **fields)
        self.session.add(goal)
        await self.session.flush()
        return goal

    async def update(self, user_id: uuid.UUID, goal_id: uuid.UUID, **fields) -> Goal | None:
        goal = await self.get(user_id, goal_id)
        if goal is None:
            return None
        for field, value in fields.items():
            setattr(goal, field, value)
        if goal.current_amount >= goal.target_amount:
            goal.status = "completed"
        elif goal.status == "completed":
            goal.status = "active"
        await self.session.flush()
        return goal

    async def count_active(self, user_id: uuid.UUID) -> int:
        return int(
            await self.session.scalar(
                select(func.count()).select_from(Goal).where(Goal.user_id == user_id, Goal.status == "active")
            )
            or 0
        )
