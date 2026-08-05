from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_service.models import Category, Transaction


@dataclass
class CategorySpend:
    """Aggregated spending/income for one category in a period."""

    category: Category
    amount: float
    transaction_count: int


class TransactionRepository:
    """Database access for transactions, including analytical aggregates.

    Every read/write is scoped by ``profile_id`` (= auth user id). The ledger is
    the source of truth: spending, income, and balance are computed here, never
    stored.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        profile_id: uuid.UUID,
        category_id: uuid.UUID,
        amount: float,
        type: str,
        title: str,
        merchant_name: str | None = None,
        description: str | None = None,
        payment_method: str | None = None,
        source: str | None = None,
        is_recurring: bool = False,
        transaction_date: datetime | None = None,
    ) -> Transaction:
        transaction = Transaction(
            profile_id=profile_id,
            category_id=category_id,
            amount=amount,
            type=type,
            title=title,
            merchant_name=merchant_name,
            description=description,
            payment_method=payment_method,
            source=source,
            is_recurring=is_recurring,
            transaction_date=transaction_date,
        )
        self.session.add(transaction)
        await self.session.flush()
        return transaction

    async def list(
        self,
        profile_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
        type: str | None = None,
        category_id: uuid.UUID | None = None,
        merchant_name: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(Transaction.profile_id == profile_id)
        )
        if type is not None:
            stmt = stmt.where(Transaction.type == type)
        if category_id is not None:
            stmt = stmt.where(Transaction.category_id == category_id)
        if merchant_name is not None:
            stmt = stmt.where(
                func.lower(Transaction.merchant_name) == merchant_name.strip().lower()
            )
        if start is not None:
            stmt = stmt.where(Transaction.transaction_date >= start)
        if end is not None:
            stmt = stmt.where(Transaction.transaction_date < end)
        stmt = (
            stmt.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        return list(result)

    async def sum_by_category(
        self,
        profile_id: uuid.UUID,
        *,
        type: str,
        start: datetime,
        end: datetime,
    ) -> list[CategorySpend]:
        """Aggregate amount + count per category for a period, largest first."""
        stmt = (
            select(Category, func.sum(Transaction.amount), func.count(Transaction.id))
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.profile_id == profile_id,
                Transaction.type == type,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
            .group_by(Category.id)
            .order_by(func.sum(Transaction.amount).desc())
        )
        result = await self.session.execute(stmt)
        return [
            CategorySpend(category=cat, amount=float(amount or 0), transaction_count=count)
            for cat, amount, count in result.all()
        ]

    async def sum_total(
        self,
        profile_id: uuid.UUID,
        *,
        type: str,
        start: datetime,
        end: datetime,
    ) -> float:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.profile_id == profile_id,
            Transaction.type == type,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
        return float(await self.session.scalar(stmt) or 0)

    async def split_recurring(
        self,
        profile_id: uuid.UUID,
        *,
        type: str,
        start: datetime,
        end: datetime,
    ) -> tuple[float, float]:
        """Return ``(recurring_total, one_time_total)`` for a period."""
        stmt = (
            select(
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.is_recurring.is_(True)), 0
                ),
                func.coalesce(
                    func.sum(Transaction.amount).filter(Transaction.is_recurring.is_(False)), 0
                ),
            )
            .where(
                Transaction.profile_id == profile_id,
                Transaction.type == type,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
        )
        result = await self.session.execute(stmt)
        row = result.one()
        return float(row[0] or 0), float(row[1] or 0)

    async def top_merchants(
        self,
        profile_id: uuid.UUID,
        *,
        start: datetime,
        end: datetime,
        limit: int = 5,
    ) -> list[dict]:
        """Top expense merchants by total amount for a period."""
        stmt = (
            select(
                Transaction.merchant_name,
                func.sum(Transaction.amount),
                func.count(Transaction.id),
            )
            .where(
                Transaction.profile_id == profile_id,
                Transaction.type == "expense",
                Transaction.merchant_name.isnot(None),
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
            )
            .group_by(Transaction.merchant_name)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [
            {
                "merchant_name": name,
                "total": float(total or 0),
                "transaction_count": count,
            }
            for name, total, count in result.all()
        ]
