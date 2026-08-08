from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ai_service.db.base import Base


def _timestamptz(**kwargs) -> Mapped[datetime]:
    """Return a ``timestamptz NOT NULL DEFAULT now()`` mapped column."""
    return mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        **kwargs,
    )


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint(
            "salary_day IS NULL OR (salary_day >= 1 AND salary_day <= 31)",
            name="profiles_salary_day_check",
        ),
        CheckConstraint(
            "income_type IS NULL OR income_type IN "
            "('salaried', 'freelancer', 'business_owner', 'retired', 'other')",
            name="profiles_income_type_check",
        ),
        CheckConstraint(
            "savings_target_percent IS NULL OR "
            "(savings_target_percent >= 0 AND savings_target_percent <= 100)",
            name="profiles_savings_target_percent_check",
        ),
        CheckConstraint(
            "investment_style IS NULL OR investment_style IN "
            "('conservative', 'moderate', 'aggressive')",
            name="profiles_investment_style_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(
        Text, nullable=False, default="INR", server_default=text("'INR'")
    )
    income_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Asia/Kolkata",
        server_default=text("'Asia/Kolkata'"),
    )
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    savings_target_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    investment_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    budget_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = _timestamptz()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    monthly_plans: Mapped[list[MonthlyPlan]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    goals: Mapped[list[Goal]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint(
            "type IN ('expense', 'income')",
            name="categories_type_check",
        ),
        CheckConstraint(
            "length(name) > 0",
            name="categories_name_not_empty_check",
        ),
        CheckConstraint(
            "parent_category_id IS NULL OR parent_category_id <> id",
            name="categories_parent_not_self_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = _timestamptz()

    parent_category: Mapped[Category | None] = relationship(
        back_populates="subcategories",
        remote_side=[id],
    )
    subcategories: Mapped[list[Category]] = relationship(
        back_populates="parent_category",
    )
    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="category",
    )


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint(
            "amount >= 0",
            name="transactions_amount_check",
        ),
        CheckConstraint(
            "type IN ('expense', 'income')",
            name="transactions_type_check",
        ),
        CheckConstraint(
            "length(title) > 0",
            name="transactions_title_not_empty_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = _timestamptz()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    profile: Mapped[Profile] = relationship(back_populates="transactions")
    category: Mapped[Category] = relationship(back_populates="transactions")


class MonthlyPlan(Base):
    __tablename__ = "monthly_plans"
    __table_args__ = (
        CheckConstraint(
            "month >= 1 AND month <= 12",
            name="monthly_plans_month_check",
        ),
        CheckConstraint(
            "year >= 2020 AND year <= 2100",
            name="monthly_plans_year_check",
        ),
        CheckConstraint(
            "expected_income >= 0",
            name="monthly_plans_expected_income_check",
        ),
        CheckConstraint(
            "minimum_savings_goal >= 0",
            name="monthly_plans_minimum_savings_goal_check",
        ),
        CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="monthly_plans_status_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_income: Mapped[float] = mapped_column(
        Numeric(14, 2), nullable=False, default=0, server_default=text("0")
    )
    minimum_savings_goal: Mapped[float] = mapped_column(
        Numeric(14, 2), nullable=False, default=0, server_default=text("0")
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="active", server_default=text("'active'")
    )
    created_at: Mapped[datetime] = _timestamptz()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    profile: Mapped[Profile] = relationship(back_populates="monthly_plans")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "target_amount > 0",
            name="goals_target_amount_check",
        ),
        CheckConstraint(
            "current_amount >= 0",
            name="goals_current_amount_check",
        ),
        CheckConstraint(
            "goal_type IS NULL OR goal_type IN "
            "('emergency_fund', 'purchase', 'vacation', 'investment', "
            "'debt_repayment', 'education', 'retirement', 'custom')",
            name="goals_goal_type_check",
        ),
        CheckConstraint(
            "status IN ('active', 'completed', 'archived')",
            name="goals_status_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[float] = mapped_column(
        Numeric(14, 2), nullable=False, default=0, server_default=text("0")
    )
    goal_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="active", server_default=text("'active'")
    )
    created_at: Mapped[datetime] = _timestamptz()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    profile: Mapped[Profile] = relationship(back_populates="goals")
