from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import GoalRepository, ProfileRepository, TransactionRepository
from ai_service.services.budget_service import BudgetService
from ai_service.utils.financial import days_remaining_in_month, minor_to_amount, resolve_period


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.profiles = ProfileRepository(session)
        self.goals = GoalRepository(session)
        self.budgets = BudgetService(session)
        self.transactions = TransactionRepository(session)

    async def get_dashboard(self, user_id: uuid.UUID, *, period: str = "this_month", today: date | None = None) -> dict:
        window = resolve_period(period, today)
        profile = await self.profiles.get(user_id)
        budget = await self.budgets.budget_status(user_id, period=period, today=today, with_current_balance=True)
        income = await self.transactions.sum_total(
            user_id, transaction_type="income", start=window.start, end=window.end
        )
        expenses = budget["total_spent"]  # the month's expense total, already read for the budget: not summed twice
        net = income - expenses
        current_balance = budget["current_balance"]
        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "currency": profile.currency if profile else "INR",
            "current_balance": current_balance,
            "display_current_balance": minor_to_amount(current_balance),
            "opening_balance": budget["opening_balance"],
            "display_opening_balance": budget["display_opening_balance"],
            "closing_balance": budget["closing_balance"],
            "display_closing_balance": budget["display_closing_balance"],
            "active_goals_count": await self.goals.count_active(user_id),
            "total_income": income,
            "display_total_income": minor_to_amount(income),
            "total_spent": expenses,
            "display_total_spent": minor_to_amount(expenses),
            "net": net,
            "display_net": minor_to_amount(net),
            "total_budgeted": budget["total_budgeted"],
            "display_total_budgeted": budget["display_total_budgeted"],
            "remaining_budget": budget["remaining"],
            "display_remaining_budget": budget["display_remaining"],
            "unassigned": budget["unassigned"],
            "display_unassigned": budget["display_unassigned"],
            "has_budget": budget["has_budget"],
            "days_remaining_in_month": days_remaining_in_month(today),
        }
