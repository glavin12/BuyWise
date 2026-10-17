from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ai_service.models import BudgetEntry


class BudgetRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def set(
        self,
        user_id: uuid.UUID,
        category_id: uuid.UUID,
        month: int,
        year: int,
        budgeted_amount: int,
    ) -> BudgetEntry:
        entry = await self.session.scalar(
            select(BudgetEntry).where(
                BudgetEntry.user_id == user_id,
                BudgetEntry.category_id == category_id,
                BudgetEntry.month == month,
                BudgetEntry.year == year,
            )
        )
        if entry is None:
            entry = BudgetEntry(
                user_id=user_id,
                category_id=category_id,
                month=month,
                year=year,
                budgeted_amount=budgeted_amount,
            )
            self.session.add(entry)
        else:
            entry.budgeted_amount = budgeted_amount
        await self.session.flush()
        await self.session.refresh(entry, attribute_names=["category"])
        return entry

    async def get_month(self, user_id: uuid.UUID, month: int, year: int) -> list[BudgetEntry]:
        result = await self.session.scalars(
            select(BudgetEntry)
            .options(joinedload(BudgetEntry.category))
            .where(
                BudgetEntry.user_id == user_id,
                BudgetEntry.month == month,
                BudgetEntry.year == year,
            )
            .order_by(BudgetEntry.category_id)
        )
        return list(result)

    async def assigned_before(self, user_id: uuid.UUID, month: int, year: int) -> dict[uuid.UUID, int]:
        """Everything assigned to each category in the months before ``month``/``year``."""
        month_index = BudgetEntry.year * 12 + BudgetEntry.month
        rows = await self.session.execute(
            select(BudgetEntry.category_id, func.sum(BudgetEntry.budgeted_amount))
            .where(BudgetEntry.user_id == user_id, month_index < year * 12 + month)
            .group_by(BudgetEntry.category_id)
        )
        return {category_id: int(amount or 0) for category_id, amount in rows.all()}

    async def get(self, user_id: uuid.UUID, budget_id: uuid.UUID) -> BudgetEntry | None:
        return await self.session.scalar(
            select(BudgetEntry)
            .options(joinedload(BudgetEntry.category))
            .where(BudgetEntry.user_id == user_id, BudgetEntry.id == budget_id)
        )

    async def update(
        self, user_id: uuid.UUID, budget_id: uuid.UUID, budgeted_amount: int
    ) -> BudgetEntry | None:
        entry = await self.get(user_id, budget_id)
        if entry is None:
            return None
        entry.budgeted_amount = budgeted_amount
        await self.session.flush()
        return entry

    async def delete(self, user_id: uuid.UUID, budget_id: uuid.UUID) -> bool:
        entry = await self.get(user_id, budget_id)
        if entry is None:
            return False
        await self.session.delete(entry)
        await self.session.flush()
        return True
