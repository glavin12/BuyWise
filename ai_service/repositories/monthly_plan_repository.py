from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import MonthlyPlan


class MonthlyPlanRepository:
    """Database access for monthly plans. Scoped by ``profile_id``.

    At most one plan is ``active`` per user (partial unique index
    ``ix_monthly_plans_active_profile``); activating a new month archives the
    previous active plan. Historical per-month plans are preserved so the AI
    can reference income changes over time.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active(self, profile_id: uuid.UUID) -> MonthlyPlan | None:
        return await self.session.scalar(
            select(MonthlyPlan).where(
                MonthlyPlan.profile_id == profile_id,
                MonthlyPlan.status == "active",
            )
        )

    async def get(
        self,
        profile_id: uuid.UUID,
        month: int,
        year: int,
    ) -> MonthlyPlan | None:
        return await self.session.scalar(
            select(MonthlyPlan).where(
                MonthlyPlan.profile_id == profile_id,
                MonthlyPlan.month == month,
                MonthlyPlan.year == year,
            )
        )

    async def create(
        self,
        profile_id: uuid.UUID,
        *,
        month: int,
        year: int,
        expected_income: float,
        minimum_savings_goal: float,
    ) -> MonthlyPlan:
        plan = MonthlyPlan(
            profile_id=profile_id,
            month=month,
            year=year,
            expected_income=expected_income,
            minimum_savings_goal=minimum_savings_goal,
            status="active",
        )
        self.session.add(plan)
        await self.session.flush()
        return plan

    async def update(
        self,
        profile_id: uuid.UUID,
        month: int,
        year: int,
        *,
        expected_income: float,
        minimum_savings_goal: float,
    ) -> MonthlyPlan | None:
        result = await self.session.execute(
            update(MonthlyPlan)
            .where(
                MonthlyPlan.profile_id == profile_id,
                MonthlyPlan.month == month,
                MonthlyPlan.year == year,
            )
            .values(
                expected_income=expected_income,
                minimum_savings_goal=minimum_savings_goal,
                status="active",
            )
        )
        if not result.rowcount:
            return None
        return await self.get(profile_id, month, year)

    async def archive_other_active(
        self,
        profile_id: uuid.UUID,
        except_month: int,
        except_year: int,
    ) -> None:
        """Archive every active plan except the given month/year."""
        await self.session.execute(
            update(MonthlyPlan)
            .where(
                MonthlyPlan.profile_id == profile_id,
                MonthlyPlan.status == "active",
                func.not_(
                    (MonthlyPlan.month == except_month)
                    & (MonthlyPlan.year == except_year)
                ),
            )
            .values(status="archived")
        )
