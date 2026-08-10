from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import BudgetRepository, CategoryRepository, TransactionRepository
from ai_service.utils.financial import minor_to_amount, month_range, resolve_period


class BudgetNotFoundError(LookupError):
    pass


class BudgetService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.budgets = BudgetRepository(session)
        self.categories = CategoryRepository(session)
        self.transactions = TransactionRepository(session)

    async def set_budget(
        self,
        user_id: uuid.UUID,
        *,
        category_id: uuid.UUID,
        month: int,
        year: int,
        budgeted_amount: int,
    ) -> dict:
        if month not in range(1, 13):
            raise ValueError("month must be between 1 and 12")
        if year not in range(2020, 2101):
            raise ValueError("year must be between 2020 and 2100")
        if budgeted_amount < 0:
            raise ValueError("budgeted_amount must be non-negative")
        category = await self.categories.get(user_id, category_id)
        if category is None or not category.is_active or category.type != "expense":
            raise ValueError("expense category not found")
        entry = await self.budgets.set(user_id, category_id, month, year, budgeted_amount)
        await self.session.commit()
        return self._entry_to_dict(entry)

    async def get_month_budgets(self, user_id: uuid.UUID, month: int, year: int) -> list[dict]:
        window = month_range(month, year)
        entries = await self.budgets.get_month(user_id, month, year)
        spent = await self.transactions.sum_by_category(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        spent_by_category = {row.category.id: row.amount for row in spent}
        return [self._budget_status(entry, spent_by_category.get(entry.category_id, 0)) for entry in entries]

    async def budget_status(self, user_id: uuid.UUID, *, period: str = "this_month") -> dict:
        window = resolve_period(period)
        rows = await self.get_month_budgets(user_id, window.month, window.year)
        total_budgeted = sum(row["budgeted_amount"] for row in rows)
        total_spent = await self.transactions.sum_total(
            user_id,
            transaction_type="expense",
            start=window.start,
            end=window.end,
        )
        return {
            "period": period,
            "month": window.month_name,
            "year": window.year,
            "has_budget": bool(rows),
            "total_budgeted": total_budgeted,
            "display_total_budgeted": minor_to_amount(total_budgeted),
            "total_spent": total_spent,
            "display_total_spent": minor_to_amount(total_spent),
            "remaining": total_budgeted - total_spent,
            "display_remaining": minor_to_amount(total_budgeted - total_spent),
            "categories": rows,
        }

    async def get_budget(self, user_id: uuid.UUID, budget_id: uuid.UUID) -> dict:
        entry = await self.budgets.get(user_id, budget_id)
        if entry is None:
            raise BudgetNotFoundError("Budget not found")
        return self._entry_to_dict(entry)

    async def update_budget(self, user_id: uuid.UUID, budget_id: uuid.UUID, budgeted_amount: int) -> dict:
        if budgeted_amount < 0:
            raise ValueError("budgeted_amount must be non-negative")
        entry = await self.budgets.update(user_id, budget_id, budgeted_amount)
        if entry is None:
            raise BudgetNotFoundError("Budget not found")
        await self.session.commit()
        return self._entry_to_dict(entry)

    async def delete_budget(self, user_id: uuid.UUID, budget_id: uuid.UUID) -> bool:
        deleted = await self.budgets.delete(user_id, budget_id)
        if not deleted:
            raise BudgetNotFoundError("Budget not found")
        await self.session.commit()
        return True

    @staticmethod
    def _entry_to_dict(entry) -> dict:
        return {
            "id": str(entry.id),
            "category_id": str(entry.category_id),
            "category": entry.category.name if entry.category else None,
            "month": entry.month,
            "year": entry.year,
            "budgeted_amount": entry.budgeted_amount,
            "display_budgeted_amount": minor_to_amount(entry.budgeted_amount),
        }

    @staticmethod
    def _budget_status(entry, spent: int) -> dict:
        remaining = entry.budgeted_amount - spent
        return {
            **BudgetService._entry_to_dict(entry),
            "spent": spent,
            "display_spent": minor_to_amount(spent),
            "remaining": remaining,
            "display_remaining": minor_to_amount(remaining),
            "percent_used": round(spent * 100 / entry.budgeted_amount, 1)
            if entry.budgeted_amount
            else 0,
        }
