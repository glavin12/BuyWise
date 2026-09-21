from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AliasPath, BaseModel, ConfigDict, Field, computed_field

from ai_service.utils.financial import minor_to_amount


CategoryType = Literal["expense", "income"]
TransactionType = Literal["expense", "income", "starting_balance"]
PaymentMethod = Literal["cash", "upi", "bank_transfer", "card", "other"]
ClearedStatus = Literal["pending", "cleared"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=30)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: CategoryType | None = None
    icon: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=30)


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    type: CategoryType
    icon: str | None = None
    color: str | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CategoryListResponse(BaseModel):
    count: int
    categories: list[CategoryResponse]


class PayeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class PayeeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class PayeeResponse(BaseModel):
    id: UUID
    name: str
    normalized_name: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PayeeListResponse(BaseModel):
    payees: list[PayeeResponse]


class TransactionCreate(BaseModel):
    category_id: UUID | None = None
    payee_id: UUID | None = None
    payee_name: str | None = Field(default=None, max_length=255)
    amount: int = Field(ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=10)
    transaction_type: TransactionType
    payment_method: PaymentMethod | None = None
    transaction_date: date = Field(default_factory=date.today)
    description: str | None = None
    notes: str | None = None
    cleared_status: ClearedStatus = "pending"


class TransactionUpdate(BaseModel):
    category_id: UUID | None = None
    payee_id: UUID | None = None
    amount: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=10)
    transaction_type: TransactionType | None = None
    payment_method: PaymentMethod | None = None
    transaction_date: date | None = None
    description: str | None = None
    notes: str | None = None
    cleared_status: ClearedStatus | None = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    category_id: UUID | None = None
    category: str | None = Field(default=None, validation_alias=AliasPath("category", "name"))
    category_icon: str | None = Field(
        default=None, validation_alias=AliasPath("category", "icon")
    )
    payee_id: UUID | None = None
    payee: str | None = Field(default=None, validation_alias=AliasPath("payee", "name"))
    amount: int
    currency: str
    transaction_type: TransactionType
    payment_method: PaymentMethod | None = None
    transaction_date: date
    description: str | None = None
    notes: str | None = None
    cleared_status: ClearedStatus
    parent_transaction_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @computed_field
    @property
    def display_amount(self) -> float:
        return minor_to_amount(self.amount)


class TransactionListResponse(BaseModel):
    period: str
    count: int
    total: int
    limit: int
    offset: int
    transactions: list[TransactionResponse]


class BudgetCreate(BaseModel):
    category_id: UUID
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2020, le=2100)
    budgeted_amount: int = Field(ge=0)


class BudgetUpdate(BaseModel):
    budgeted_amount: int = Field(ge=0)


class BudgetResponse(BaseModel):
    id: UUID
    category_id: UUID
    category: str | None = None
    month: int
    year: int
    budgeted_amount: int
    display_budgeted_amount: float
    spent: int | None = None
    display_spent: float | None = None
    remaining: int | None = None
    display_remaining: float | None = None
    percent_used: float | None = None


class BudgetMonthResponse(BaseModel):
    month: int
    year: int
    budgets: list[BudgetResponse]


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category_id: UUID | None = None
    description: str | None = None
    target_amount: int = Field(gt=0)
    current_amount: int = Field(default=0, ge=0)
    goal_type: str | None = None
    priority: str | None = None
    target_date: date | None = None


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: UUID | None = None
    description: str | None = None
    target_amount: int | None = Field(default=None, gt=0)
    current_amount: int | None = Field(default=None, ge=0)
    goal_type: str | None = None
    priority: str | None = None
    target_date: date | None = None
    status: Literal["active", "completed", "archived"] | None = None


class GoalResponse(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    category_id: UUID | None = None
    category: str | None = None
    goal_type: str | None = None
    priority: str | None = None
    target_amount: int
    display_target_amount: float
    current_amount: int
    display_current_amount: float
    progress_percent: float
    remaining_amount: int
    display_remaining_amount: float
    target_date: str | None = None
    monthly_needed_to_hit_target: int | None = None
    display_monthly_needed_to_hit_target: float | None = None
    days_remaining_in_month: int
    status: str


class GoalsListResponse(BaseModel):
    status: str
    count: int
    goals: list[GoalResponse]


class MonthlySummaryResponse(BaseModel):
    month: int
    year: int
    income: int
    expenses: int
    net: int


class CategorySpendingResponse(BaseModel):
    category_id: UUID
    category: str
    icon: str | None = None
    color: str | None = None
    amount: int
    display_amount: float
    transaction_count: int
    percent_of_total: float


class PaymentMethodSpendingResponse(BaseModel):
    payment_method: str | None = None
    amount: int
    display_amount: float
    transaction_count: int
    percent_of_total: float


class MonthComparisonResponse(BaseModel):
    first: MonthlySummaryResponse
    second: MonthlySummaryResponse
    change: dict[str, dict]


class DashboardResponse(BaseModel):
    period: str
    month: str
    year: int
    currency: str
    current_balance: int
    display_current_balance: float
    active_goals_count: int
    total_income: int
    display_total_income: float
    total_spent: int
    display_total_spent: float
    net: int
    display_net: float
    total_budgeted: int
    display_total_budgeted: float
    remaining_budget: int
    display_remaining_budget: float
    unassigned: int
    display_unassigned: float
    has_budget: bool
    days_remaining_in_month: int
