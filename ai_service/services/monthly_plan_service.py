from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import MonthlyPlan
from ai_service.repositories import MonthlyPlanRepository, TransactionRepository
from ai_service.utils.financial import (
    days_elapsed_in_month,
    days_remaining_in_month,
    resolve_period,
)


class MonthlyPlanService:
    """Business logic for monthly plans and budget status.

    The plan stores only user intentions (expected income, minimum savings).
    Every "how am I doing" figure is computed from the transaction ledger.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.plans = MonthlyPlanRepository(session)
        self.transactions = TransactionRepository(session)

    async def get_active_plan(self, user_id: uuid.UUID) -> MonthlyPlan | None:
        return await self.plans.get_active(user_id)

    async def set_plan(
        self,
        user_id: uuid.UUID,
        *,
        month: int,
        year: int,
        expected_income: float | None = None,
        minimum_savings_goal: float | None = None,
    ) -> dict:
        """Create or update the plan for ``(month, year)`` and make it active.

        Any other active plan is archived (the partial unique index allows only
        one active plan per user).
        """
        existing = await self.plans.get(user_id, month, year)
        if existing is None:
            plan = await self.plans.create(
                user_id,
                month=month,
                year=year,
                expected_income=expected_income or 0,
                minimum_savings_goal=minimum_savings_goal or 0,
            )
        else:
            plan = await self.plans.update(
                user_id,
                month,
                year,
                expected_income=(
                    float(existing.expected_income)
                    if expected_income is None
                    else expected_income
                ),
                minimum_savings_goal=(
                    float(existing.minimum_savings_goal)
                    if minimum_savings_goal is None
                    else minimum_savings_goal
                ),
            )
        await self.plans.archive_other_active(user_id, month, year)
        await self.session.commit()
        return self._plan_to_dict(plan)

    async def budget_status(
        self,
        user_id: uuid.UUID,
        *,
        period: str = "this_month",
    ) -> dict:
        """Tool-facing plan-vs-actual comparison for a period."""
        window = resolve_period(period)
        plan = await self.plans.get(user_id, window.month, window.year)

        expected_income = float(plan.expected_income) if plan else 0.0
        minimum_savings_goal = float(plan.minimum_savings_goal) if plan else 0.0

        actual_income = await self.transactions.sum_total(
            user_id, type="income", start=window.start, end=window.end
        )
        total_spent = await self.transactions.sum_total(
            user_id, type="expense", start=window.start, end=window.end
        )
        actual_savings = round(actual_income - total_spent, 2)
        remaining_balance = round(expected_income - total_spent, 2)
        savings_on_track = (
            bool(plan)
            and actual_savings >= minimum_savings_goal
        )

        days_remaining = days_remaining_in_month()
        daily_budget_remaining = (
            round(remaining_balance / days_remaining, 2)
            if days_remaining > 0 and remaining_balance > 0
            else 0.0
        )

        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "has_plan": plan is not None,
            "expected_income": round(expected_income, 2),
            "minimum_savings_goal": round(minimum_savings_goal, 2),
            "actual_income": round(actual_income, 2),
            "total_spent": round(total_spent, 2),
            "actual_savings": actual_savings,
            "savings_on_track": savings_on_track,
            "remaining_balance": remaining_balance,
            "days_elapsed": days_elapsed_in_month(),
            "days_remaining": days_remaining,
            "daily_budget_remaining": daily_budget_remaining,
            "currency": "INR",
        }

    def _plan_to_dict(self, plan: MonthlyPlan) -> dict:
        return {
            "id": str(plan.id),
            "month": plan.month,
            "year": plan.year,
            "expected_income": float(plan.expected_income),
            "minimum_savings_goal": float(plan.minimum_savings_goal),
            "status": plan.status,
        }
