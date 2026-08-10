from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_service.models import Category, Payee, Transaction


@dataclass
class CategorySpend:
    category: Category
    amount: int
    transaction_count: int


class TransactionRepository:
    """User-scoped ledger queries and integer-only financial aggregates."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, **fields) -> Transaction:
        transaction = Transaction(user_id=user_id, **fields)
        self.session.add(transaction)
        await self.session.flush()
        await self.session.refresh(transaction)
        return transaction

    async def get(self, user_id: uuid.UUID, transaction_id: uuid.UUID) -> Transaction | None:
        return await self.session.scalar(
            select(Transaction)
            .options(
                selectinload(Transaction.account),
                selectinload(Transaction.category),
                selectinload(Transaction.payee),
            )
            .where(Transaction.user_id == user_id, Transaction.id == transaction_id)
        )

    async def list(
        self,
        user_id: uuid.UUID,
        *,
        limit: int = 20,
        offset: int = 0,
        account_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        payee_id: uuid.UUID | None = None,
        transaction_type: str | None = None,
        cleared_status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .options(
                selectinload(Transaction.account),
                selectinload(Transaction.category),
                selectinload(Transaction.payee),
            )
            .where(Transaction.user_id == user_id)
        )
        if account_id is not None:
            stmt = stmt.where(Transaction.account_id == account_id)
        if category_id is not None:
            stmt = stmt.where(Transaction.category_id == category_id)
        if payee_id is not None:
            stmt = stmt.where(Transaction.payee_id == payee_id)
        if transaction_type is not None:
            stmt = stmt.where(Transaction.transaction_type == transaction_type)
        if cleared_status is not None:
            stmt = stmt.where(Transaction.cleared_status == cleared_status)
        if date_from is not None:
            stmt = stmt.where(Transaction.transaction_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Transaction.transaction_date <= date_to)
        result = await self.session.scalars(
            stmt.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result)

    async def count(self, user_id: uuid.UUID, **filters) -> int:
        stmt = select(func.count()).select_from(Transaction).where(Transaction.user_id == user_id)
        for field, value in filters.items():
            if value is None:
                continue
            if field == "date_from":
                stmt = stmt.where(Transaction.transaction_date >= value)
            elif field == "date_to":
                stmt = stmt.where(Transaction.transaction_date <= value)
            else:
                stmt = stmt.where(getattr(Transaction, field) == value)
        return int(await self.session.scalar(stmt) or 0)

    async def update(self, user_id: uuid.UUID, transaction_id: uuid.UUID, **fields) -> Transaction | None:
        transaction = await self.get(user_id, transaction_id)
        if transaction is None:
            return None
        for field, value in fields.items():
            setattr(transaction, field, value)
        await self.session.flush()
        await self.session.refresh(transaction)
        return await self.get(user_id, transaction_id)

    async def delete(self, user_id: uuid.UUID, transaction_id: uuid.UUID) -> bool:
        transaction = await self.get(user_id, transaction_id)
        if transaction is None:
            return False
        await self.session.delete(transaction)
        await self.session.flush()
        return True

    async def sum_total(
        self,
        user_id: uuid.UUID,
        *,
        transaction_type: str,
        start: date,
        end: date,
    ) -> int:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == transaction_type,
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
            Transaction.parent_transaction_id.is_(None),
        )
        return int(await self.session.scalar(stmt) or 0)

    async def sum_by_category(
        self,
        user_id: uuid.UUID,
        *,
        transaction_type: str,
        start: date,
        end: date,
    ) -> list[CategorySpend]:
        stmt = (
            select(Category, func.sum(Transaction.amount), func.count(Transaction.id))
            .join(Transaction, Transaction.category_id == Category.id)
            .where(
                Transaction.user_id == user_id,
                Category.user_id == user_id,
                Transaction.transaction_type == transaction_type,
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
                Transaction.parent_transaction_id.is_(None),
            )
            .group_by(Category.id)
            .order_by(func.sum(Transaction.amount).desc())
        )
        result = await self.session.execute(stmt)
        return [
            CategorySpend(category=category, amount=int(amount or 0), transaction_count=int(count))
            for category, amount, count in result.all()
        ]

    async def get_balance(self, user_id: uuid.UUID, account_id: uuid.UUID) -> int:
        signed_amount = case(
            (Transaction.transaction_type.in_(("income", "starting_balance")), Transaction.amount),
            (Transaction.transaction_type == "expense", -Transaction.amount),
            (
                Transaction.transaction_type == "transfer",
                case((Transaction.transfer_direction == "in", Transaction.amount), else_=-Transaction.amount),
            ),
            else_=0,
        )
        stmt = select(func.coalesce(func.sum(signed_amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.account_id == account_id,
            Transaction.parent_transaction_id.is_(None),
        )
        return int(await self.session.scalar(stmt) or 0)

    async def sum_transfer_out(self, user_id: uuid.UUID, *, start: date, end: date) -> int:
        stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == "transfer",
            Transaction.transfer_direction == "out",
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
            Transaction.parent_transaction_id.is_(None),
        )
        return int(await self.session.scalar(stmt) or 0)

    async def get_transfer_group(
        self, user_id: uuid.UUID, transfer_group_id: uuid.UUID
    ) -> list[Transaction]:
        result = await self.session.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.transfer_group_id == transfer_group_id,
            )
        )
        return list(result)

    async def top_payees(
        self,
        user_id: uuid.UUID,
        *,
        start: date,
        end: date,
        limit: int = 5,
    ) -> list[dict]:
        stmt = (
            select(Payee, func.sum(Transaction.amount), func.count(Transaction.id))
            .join(Transaction, Transaction.payee_id == Payee.id)
            .where(
                Transaction.user_id == user_id,
                Payee.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.transaction_date >= start,
                Transaction.transaction_date < end,
                Transaction.parent_transaction_id.is_(None),
            )
            .group_by(Payee.id)
            .order_by(func.sum(Transaction.amount).desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [
            {
                "payee_id": str(payee.id),
                "payee": payee.name,
                "total": int(total or 0),
                "transaction_count": int(count),
            }
            for payee, total, count in result.all()
        ]
