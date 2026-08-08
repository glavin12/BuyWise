from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Transaction
from ai_service.repositories import CategoryRepository, TransactionRepository
from ai_service.utils.financial import (
    days_elapsed_in_month,
    fmt_money,
    resolve_period,
)


class CategoryNotFoundError(LookupError):
    """Raised when a category name does not resolve for the given type."""


class TransactionService:
    """Business logic for the transaction ledger.

    Transactions are the source of truth. Analytical tools (spending breakdown,
    income summary) compute their results here from the ledger — never stored.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.transactions = TransactionRepository(session)
        self.categories = CategoryRepository(session)

    async def list_transactions(
        self,
        user_id: uuid.UUID,
        *,
        limit: int = 10,
        offset: int = 0,
        type: str | None = None,
        category_id: uuid.UUID | None = None,
        merchant_name: str | None = None,
        period: str | None = None,
    ) -> dict:
        """Tool-facing list of transactions with category details."""
        start = end = None
        if period is not None:
            window = resolve_period(period)
            start, end = window.start, window.end
        rows = await self.transactions.list(
            user_id,
            limit=limit,
            offset=offset,
            type=type,
            category_id=category_id,
            merchant_name=merchant_name,
            start=start,
            end=end,
        )
        return {
            "period": period or "all",
            "count": len(rows),
            "transactions": [
                self._transaction_to_dict(t) for t in rows
            ],
        }

    async def add_transaction(
        self,
        user_id: uuid.UUID,
        *,
        amount: float,
        type: str,
        title: str,
        category_name: str,
        merchant_name: str | None = None,
        description: str | None = None,
        payment_method: str | None = None,
        is_recurring: bool = False,
        transaction_date: datetime | None = None,
    ) -> dict:
        """Add a transaction, resolving ``category_name`` to a category id."""
        if amount <= 0:
            raise ValueError("amount must be a positive number")
        if type not in ("expense", "income"):
            raise ValueError("type must be 'expense' or 'income'")

        category = await self.categories.find_by_name(category_name, type)
        if category is None:
            raise CategoryNotFoundError(
                f"Category '{category_name}' not found for type '{type}'"
            )

        transaction = await self.transactions.create(
            profile_id=user_id,
            category_id=category.id,
            amount=amount,
            type=type,
            title=title,
            merchant_name=merchant_name,
            description=description,
            payment_method=payment_method,
            is_recurring=is_recurring,
            transaction_date=transaction_date,
        )
        await self.session.commit()
        result = self._transaction_to_dict(transaction)
        result["category"] = category.name
        result["category_icon"] = category.icon
        return result

    async def spending_breakdown(
        self,
        user_id: uuid.UUID,
        *,
        period: str = "this_month",
    ) -> dict:
        """Tool-facing spending analysis for a period."""
        window = resolve_period(period)
        total_spent = await self.transactions.sum_total(
            user_id, type="expense", start=window.start, end=window.end
        )
        by_category = await self.transactions.sum_by_category(
            user_id, type="expense", start=window.start, end=window.end
        )
        recurring, one_time = await self.transactions.split_recurring(
            user_id, type="expense", start=window.start, end=window.end
        )
        top_merchants = await self.transactions.top_merchants(
            user_id, start=window.start, end=window.end, limit=5
        )

        elapsed = days_elapsed_in_month()
        daily_average = round(total_spent / elapsed, 2) if elapsed else 0

        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "currency": "INR",
            "total_spent": round(total_spent, 2),
            "transaction_count": sum(c.transaction_count for c in by_category),
            "daily_average": daily_average,
            "recurring_total": round(recurring, 2),
            "one_time_total": round(one_time, 2),
            "top_merchants": top_merchants,
            "by_category": [
                {
                    "category": c.category.name,
                    "icon": c.category.icon,
                    "color": c.category.color,
                    "amount": round(c.amount, 2),
                    "percent_of_total": round(
                        (c.amount / total_spent * 100) if total_spent else 0, 1
                    ),
                    "transaction_count": c.transaction_count,
                }
                for c in by_category
            ],
        }

    async def income_summary(
        self,
        user_id: uuid.UUID,
        *,
        period: str = "this_month",
    ) -> dict:
        """Tool-facing income analysis for a period."""
        window = resolve_period(period)
        total_income = await self.transactions.sum_total(
            user_id, type="income", start=window.start, end=window.end
        )
        by_category = await self.transactions.sum_by_category(
            user_id, type="income", start=window.start, end=window.end
        )
        recurring, one_time = await self.transactions.split_recurring(
            user_id, type="income", start=window.start, end=window.end
        )

        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "currency": "INR",
            "total_income": round(total_income, 2),
            "transaction_count": sum(c.transaction_count for c in by_category),
            "recurring_income": round(recurring, 2),
            "one_time_income": round(one_time, 2),
            "by_category": [
                {
                    "category": c.category.name,
                    "icon": c.category.icon,
                    "amount": round(c.amount, 2),
                    "transaction_count": c.transaction_count,
                }
                for c in by_category
            ],
        }

    def _transaction_to_dict(self, t: Transaction) -> dict:
        category_name = t.category.name if t.category else None
        category_icon = t.category.icon if t.category else None
        return {
            "id": str(t.id),
            "title": t.title,
            "merchant_name": t.merchant_name,
            "amount": float(t.amount),
            "type": t.type,
            "category": category_name,
            "category_icon": category_icon,
            "payment_method": t.payment_method,
            "is_recurring": t.is_recurring,
            "description": t.description,
            "transaction_date": t.transaction_date.isoformat()
            if t.transaction_date
            else None,
        }
