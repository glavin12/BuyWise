from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, JSON, BigInteger, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from ai_service.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint(
            "salary_day IS NULL OR (salary_day >= 1 AND salary_day <= 31)",
            name="profiles_salary_day_check",
        ),
        CheckConstraint(
            "income_type IS NULL OR income_type IN ('salaried', 'freelancer', 'business_owner', 'retired', 'other')",
            name="profiles_income_type_check",
        ),
        CheckConstraint(
            "savings_target_percent IS NULL OR (savings_target_percent >= 0 AND savings_target_percent <= 100)",
            name="profiles_savings_target_percent_check",
        ),
        CheckConstraint(
            "investment_style IS NULL OR investment_style IN ('conservative', 'moderate', 'aggressive')",
            name="profiles_investment_style_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="INR", server_default=text("'INR'"))
    income_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    salary_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(
        Text, nullable=False, default="Asia/Kolkata", server_default=text("'Asia/Kolkata'")
    )
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    savings_target_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    investment_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    budget_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    categories: Mapped[list[Category]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payees: Mapped[list[Payee]] = relationship(back_populates="user", cascade="all, delete-orphan")
    transactions: Mapped[list[Transaction]] = relationship(back_populates="user", cascade="all, delete-orphan")
    budget_entries: Mapped[list[BudgetEntry]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    goals: Mapped[list[Goal]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("type IN ('expense', 'income')", name="categories_type_check"),
        CheckConstraint("length(name) > 0", name="categories_name_not_empty_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Profile] = relationship(back_populates="categories")
    transactions: Mapped[list[Transaction]] = relationship(back_populates="category")
    budget_entries: Mapped[list[BudgetEntry]] = relationship(back_populates="category")
    goals: Mapped[list[Goal]] = relationship(back_populates="category")


class Payee(Base):
    __tablename__ = "payees"
    __table_args__ = (
        CheckConstraint("length(name) > 0", name="payees_name_not_empty_check"),
        CheckConstraint("type IN ('expense', 'income')", name="payees_type_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'expense'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Profile] = relationship(back_populates="payees")
    transactions: Mapped[list[Transaction]] = relationship(back_populates="payee")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="transactions_amount_check"),
        CheckConstraint(
            "transaction_type IN ('expense', 'income', 'starting_balance')",
            name="transactions_type_check",
        ),
        CheckConstraint(
            "cleared_status IN ('pending', 'cleared')", name="transactions_cleared_status_check"
        ),
        CheckConstraint(
            "parent_transaction_id IS NULL OR parent_transaction_id <> id",
            name="transactions_parent_not_self_check",
        ),
        CheckConstraint(
            "payment_method IS NULL OR payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'other')",
            name="transactions_payment_method_check",
        ),
        CheckConstraint(
            "(transaction_type = 'starting_balance') OR (category_id IS NOT NULL)",
            name="transactions_category_required_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    payee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("payees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="INR", server_default=text("'INR'"))
    transaction_type: Mapped[str] = mapped_column(Text, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=text("CURRENT_DATE"))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cleared_status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending", server_default=text("'pending'")
    )
    parent_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Profile] = relationship(back_populates="transactions")
    category: Mapped[Category | None] = relationship(back_populates="transactions")
    payee: Mapped[Payee | None] = relationship(back_populates="transactions")
    parent_transaction: Mapped[Transaction | None] = relationship(
        remote_side=[id], back_populates="split_transactions"
    )
    split_transactions: Mapped[list[Transaction]] = relationship(back_populates="parent_transaction")


class BudgetEntry(Base):
    __tablename__ = "budget_entries"
    __table_args__ = (
        CheckConstraint("month >= 1 AND month <= 12", name="budget_entries_month_check"),
        CheckConstraint("year >= 2020 AND year <= 2100", name="budget_entries_year_check"),
        CheckConstraint("budgeted_amount >= 0", name="budget_entries_amount_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    budgeted_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Profile] = relationship(back_populates="budget_entries")
    category: Mapped[Category] = relationship(back_populates="budget_entries")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("length(title) > 0", name="goals_title_not_empty_check"),
        CheckConstraint("target_amount > 0", name="goals_target_amount_check"),
        CheckConstraint("current_amount >= 0", name="goals_current_amount_check"),
        CheckConstraint(
            "goal_type IS NULL OR goal_type IN ('emergency_fund', 'purchase', 'vacation', 'investment', 'debt_repayment', 'education', 'retirement', 'custom')",
            name="goals_goal_type_check",
        ),
        CheckConstraint("status IN ('active', 'completed', 'archived')", name="goals_status_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    current_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default=text("0"))
    goal_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active", server_default=text("'active'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[Profile] = relationship(back_populates="goals")
    category: Mapped[Category | None] = relationship(back_populates="goals")
