from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import GoalRepository, ProfileRepository
from ai_service.services.account_service import AccountService
from ai_service.services.analytics_service import AnalyticsService
from ai_service.services.budget_service import BudgetService
from ai_service.utils.financial import days_remaining_in_month, minor_to_amount, resolve_period


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.profiles = ProfileRepository(session)
        self.goals = GoalRepository(session)
        self.analytics = AnalyticsService(session)
        self.budgets = BudgetService(session)

    async def get_dashboard(self, user_id: uuid.UUID, *, period: str = "this_month") -> dict:
        window = resolve_period(period)
        profile = await self.profiles.get(user_id)
        summary = await self.analytics.monthly_summary(user_id, window.month, window.year)
        budget = await self.budgets.budget_status(user_id, period=period)
        account_balances = await AccountService(self.session).list_accounts(user_id)
        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "currency": profile.currency if profile else "INR",
            "account_balances": account_balances,
            "active_goals_count": await self.goals.count_active(user_id),
            "total_income": summary["income"],
            "display_total_income": minor_to_amount(summary["income"]),
            "total_spent": summary["expenses"],
            "display_total_spent": minor_to_amount(summary["expenses"]),
            "net": summary["net"],
            "display_net": minor_to_amount(summary["net"]),
            "total_budgeted": budget["total_budgeted"],
            "display_total_budgeted": budget["display_total_budgeted"],
            "remaining_budget": budget["remaining"],
            "display_remaining_budget": budget["display_remaining"],
            "has_budget": budget["has_budget"],
            "days_remaining_in_month": days_remaining_in_month(),
        }
