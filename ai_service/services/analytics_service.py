from __future__ import annotations

import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import TransactionRepository
from ai_service.utils.financial import (
    days_elapsed_in_month,
    month_range,
    minor_to_amount,
    resolve_period,
)


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transactions = TransactionRepository(session)

    async def monthly_summary(self, user_id: uuid.UUID, month: int, year: int) -> dict:
        window = month_range(month, year)
        income = await self.transactions.sum_total(
            user_id, transaction_type="income", start=window.start, end=window.end
        )
        expenses = await self.transactions.sum_total(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        return {
            "month": month,
            "year": year,
            "income": income,
            "expenses": expenses,
            "net": income - expenses,
        }

    async def category_spending(self, user_id: uuid.UUID, month: int, year: int) -> list[dict]:
        window = month_range(month, year)
        rows = await self.transactions.sum_by_category(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        total = sum(row.amount for row in rows)
        return [
            {
                "category_id": str(row.category.id),
                "category": row.category.name,
                "icon": row.category.icon,
                "color": row.category.color,
                "amount": row.amount,
                "display_amount": minor_to_amount(row.amount),
                "transaction_count": row.transaction_count,
                "percent_of_total": round(row.amount * 100 / total, 1) if total else 0,
            }
            for row in rows
        ]

    async def payment_method_spending(self, user_id: uuid.UUID, month: int, year: int) -> list[dict]:
        window = month_range(month, year)
        rows = await self.transactions.sum_by_payment_method(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        total = sum(row.amount for row in rows)
        return [
            {
                "payment_method": row.method,
                "amount": row.amount,
                "display_amount": minor_to_amount(row.amount),
                "transaction_count": row.transaction_count,
                "percent_of_total": round(row.amount * 100 / total, 1) if total else 0,
            }
            for row in rows
        ]

    async def month_comparison(
        self,
        user_id: uuid.UUID,
        month1: int,
        year1: int,
        month2: int,
        year2: int,
    ) -> dict:
        first = await self.monthly_summary(user_id, month1, year1)
        second = await self.monthly_summary(user_id, month2, year2)
        return {
            "first": first,
            "second": second,
            "change": {
                field: self._change(second[field], first[field])
                for field in ("income", "expenses", "net")
            },
        }

    async def spending_breakdown(self, user_id: uuid.UUID, *, period: str = "this_month") -> dict:
        window = resolve_period(period)
        rows = await self.transactions.sum_by_category(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        total = sum(row.amount for row in rows)
        top_payees = await self.transactions.top_payees(
            user_id, start=window.start, end=window.end
        )
        elapsed = days_elapsed_in_month()
        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "total_spent": total,
            "display_total_spent": minor_to_amount(total),
            "transaction_count": sum(row.transaction_count for row in rows),
            "daily_average": minor_to_amount(round(total / elapsed)) if elapsed else 0,
            "top_payees": top_payees,
            "by_category": [
                {
                    "category": row.category.name,
                    "icon": row.category.icon,
                    "color": row.category.color,
                    "amount": row.amount,
                    "display_amount": minor_to_amount(row.amount),
                    "percent_of_total": round(row.amount * 100 / total, 1) if total else 0,
                    "transaction_count": row.transaction_count,
                }
                for row in rows
            ],
        }

    async def income_summary(self, user_id: uuid.UUID, *, period: str = "this_month") -> dict:
        window = resolve_period(period)
        rows = await self.transactions.sum_by_category(
            user_id, transaction_type="income", start=window.start, end=window.end
        )
        total = sum(row.amount for row in rows)
        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "total_income": total,
            "display_total_income": minor_to_amount(total),
            "transaction_count": sum(row.transaction_count for row in rows),
            "by_category": [
                {
                    "category": row.category.name,
                    "amount": row.amount,
                    "display_amount": minor_to_amount(row.amount),
                    "transaction_count": row.transaction_count,
                }
                for row in rows
            ],
        }

    @staticmethod
    def _change(current: int, previous: int) -> dict:
        delta = current - previous
        return {
            "amount": delta,
            "display_amount": minor_to_amount(delta),
            "percent": round(delta * 100 / previous, 1) if previous else None,
        }
