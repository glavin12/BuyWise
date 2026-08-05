from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Profile
from ai_service.repositories import (
    GoalRepository,
    MonthlyPlanRepository,
    ProfileRepository,
    TransactionRepository,
)
from ai_service.utils.financial import (
    days_remaining_in_month,
    resolve_period,
)


class DashboardService:
    """Aggregates the current-month financial snapshot for the dashboard tool.

    Compose: active plan + transaction ledger sums + goal count + profile.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.profiles = ProfileRepository(session)
        self.plans = MonthlyPlanRepository(session)
        self.transactions = TransactionRepository(session)
        self.goals = GoalRepository(session)

    async def get_dashboard(
        self,
        user_id: uuid.UUID,
        *,
        period: str = "this_month",
    ) -> dict:
        window = resolve_period(period)
        plan = await self.plans.get(user_id, window.month, window.year)
        profile = await self.profiles.get(user_id)

        expected_income = float(plan.expected_income) if plan else 0.0
        minimum_savings_goal = float(plan.minimum_savings_goal) if plan else 0.0

        total_income = await self.transactions.sum_total(
            user_id, type="income", start=window.start, end=window.end
        )
        total_spent = await self.transactions.sum_total(
            user_id, type="expense", start=window.start, end=window.end
        )
        active_goals = await self.goals.count_active(user_id)

        actual_savings = round(total_income - total_spent, 2)
        remaining_balance = round(expected_income - total_spent, 2)

        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "currency": profile.currency if profile else "INR",
            "has_plan": plan is not None,
            "expected_income": round(expected_income, 2),
            "minimum_savings_goal": round(minimum_savings_goal, 2),
            "total_income_received": round(total_income, 2),
            "total_spent": round(total_spent, 2),
            "current_balance": remaining_balance,
            "actual_savings": actual_savings,
            "active_goals_count": active_goals,
            "days_remaining_in_month": days_remaining_in_month(),
        }
