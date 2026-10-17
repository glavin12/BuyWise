from __future__ import annotations

import uuid
from datetime import date

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

    async def month_view(self, user_id: uuid.UUID, month: int, year: int) -> dict:
        """One month of envelope budgeting.

        Nothing is stored: a category's carry-over is everything assigned in earlier months minus
        what was spent since it was first budgeted, so editing an old transaction or budget fixes
        every later month. Overspending carries over as a negative.

            available = carried_in + assigned (this month) - spent (this month)
            unassigned = closing balance - sum of every envelope's available

        so ``closing balance = money in envelopes + unassigned`` always holds. Only categories with
        a budget entry in this month or before count as envelopes; spending elsewhere simply lowers
        the closing balance, and so the unassigned money.
        """
        window = month_range(month, year)
        entries = await self.budgets.get_month(user_id, month, year)
        spent_rows = await self.transactions.sum_by_category(
            user_id, transaction_type="expense", start=window.start, end=window.end
        )
        spent = {row.category.id: row.amount for row in spent_rows}
        assigned_before = await self.budgets.assigned_before(user_id, month, year)
        spent_before = await self.transactions.spent_since_first_budget(
            user_id, month=month, year=year, before=window.start
        )
        carried_in = {
            category_id: assigned - spent_before.get(category_id, 0)
            for category_id, assigned in assigned_before.items()
        }

        rows = [
            self._budget_status(entry, spent.get(entry.category_id, 0), carried_in.get(entry.category_id, 0))
            for entry in entries
        ]
        budgeted_now = {entry.category_id for entry in entries}
        # Categories that carry money in (or were spent from) but have no entry this month. They are named with
        # one query: a lookup per category made this view's cost grow with how many there are.
        carried_ids = [
            category_id
            for category_id, carry in carried_in.items()
            if category_id not in budgeted_now and (carry != 0 or spent.get(category_id, 0) != 0)
        ]
        names = {category.id: category.name for category in await self.categories.get_many(user_id, carried_ids)}
        carried = [
            self._carried_row(category_id, names.get(category_id), carried_in[category_id], spent.get(category_id, 0))
            for category_id in carried_ids
        ]
        carried.sort(key=lambda row: (row["category"] or "", row["category_id"]))

        envelopes = sum(row["available"] for row in rows) + sum(row["available"] for row in carried)
        # One pass over the user's rows gives the opening and closing balances and the live one.
        opening, closing, current = await self.transactions.get_balances(user_id, [window.start, window.end, None])
        unassigned = closing - envelopes
        return {
            "month": month,
            "year": year,
            "budgets": rows,
            "carried": carried,
            "opening_balance": opening,
            "display_opening_balance": minor_to_amount(opening),
            "closing_balance": closing,
            "display_closing_balance": minor_to_amount(closing),
            "unassigned": unassigned,
            "display_unassigned": minor_to_amount(unassigned),
            "current_balance": current,  # the live balance, for the dashboard (`budget_status`); the month route omits it
            # Every expense this month: an expense always has a category, so its per-category sums add up to it.
            "total_spent": sum(spent.values()),
        }

    async def budget_status(
        self,
        user_id: uuid.UUID,
        *,
        period: str = "this_month",
        today: date | None = None,
        with_current_balance: bool = False,
    ) -> dict:
        """The month's budget picture; `with_current_balance` adds the live balance, read with the month's own."""
        window = resolve_period(period, today)
        view = await self.month_view(user_id, window.month, window.year)
        rows = view["budgets"]
        total_budgeted = sum(row["budgeted_amount"] for row in rows)
        total_spent = view["total_spent"]
        status = {
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
            "carried": view["carried"],
            "opening_balance": view["opening_balance"],
            "display_opening_balance": view["display_opening_balance"],
            "closing_balance": view["closing_balance"],
            "display_closing_balance": view["display_closing_balance"],
            "unassigned": view["unassigned"],
            "display_unassigned": view["display_unassigned"],
        }
        if with_current_balance:
            status["current_balance"] = view["current_balance"]
        return status

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
    def _budget_status(entry, spent: int, carried_in: int = 0) -> dict:
        """``remaining`` and ``percent_used`` are this month's alone; ``available`` includes the carry-over."""
        remaining = entry.budgeted_amount - spent
        available = carried_in + remaining
        return {
            **BudgetService._entry_to_dict(entry),
            "spent": spent,
            "display_spent": minor_to_amount(spent),
            "remaining": remaining,
            "display_remaining": minor_to_amount(remaining),
            "percent_used": round(spent * 100 / entry.budgeted_amount, 1)
            if entry.budgeted_amount
            else 0,
            "carried_in": carried_in,
            "display_carried_in": minor_to_amount(carried_in),
            "available": available,
            "display_available": minor_to_amount(available),
        }

    @staticmethod
    def _carried_row(category_id: uuid.UUID, name: str | None, carried_in: int, spent: int) -> dict:
        """A category with money carried in but no budget entry this month."""
        available = carried_in - spent
        return {
            "category_id": str(category_id),
            "category": name,
            "carried_in": carried_in,
            "display_carried_in": minor_to_amount(carried_in),
            "spent": spent,
            "display_spent": minor_to_amount(spent),
            "available": available,
            "display_available": minor_to_amount(available),
        }
