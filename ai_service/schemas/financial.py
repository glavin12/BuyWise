from __future__ import annotations

from pydantic import BaseModel


class DashboardResponse(BaseModel):
    period: str
    month: str
    year: int
    currency: str
    has_plan: bool
    expected_income: float
    minimum_savings_goal: float
    total_income_received: float
    total_spent: float
    current_balance: float
    actual_savings: float
    active_goals_count: int
    days_remaining_in_month: int


class GoalResponse(BaseModel):
    id: str
    title: str
    description: str | None
    goal_type: str | None
    priority: str | None
    target_amount: float
    current_amount: float
    progress_percent: float
    remaining_amount: float
    target_date: str | None
    monthly_needed_to_hit_target: float | None
    days_remaining_in_month: int
    status: str


class GoalsListResponse(BaseModel):
    status: str
    count: int
    goals: list[GoalResponse]


class TransactionResponse(BaseModel):
    id: str
    title: str
    merchant_name: str | None
    amount: float
    type: str
    category: str | None
    category_icon: str | None
    payment_method: str | None
    is_recurring: bool
    description: str | None
    transaction_date: str | None


class TransactionsListResponse(BaseModel):
    period: str
    count: int
    transactions: list[TransactionResponse]
