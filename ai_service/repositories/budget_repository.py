from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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
        """Create the budget for this category and month, or replace its amount: one statement, so two saves that
        race both succeed (a read first, then an insert, made the loser fail on the unique constraint).

        ``category`` is not loaded; the caller already has the category row and names it.
        """
        insert = sqlite_insert if self.session.get_bind().dialect.name == "sqlite" else postgresql_insert
        statement = insert(BudgetEntry).values(
            user_id=user_id, category_id=category_id, month=month, year=year, budgeted_amount=budgeted_amount
        )
        statement = statement.on_conflict_do_update(
            index_elements=[BudgetEntry.user_id, BudgetEntry.category_id, BudgetEntry.month, BudgetEntry.year],
            # ON CONFLICT bypasses the column's onupdate, so the timestamp is set here.
            set_={"budgeted_amount": statement.excluded.budgeted_amount, "updated_at": func.now()},
        ).returning(BudgetEntry)
        # populate_existing: the session may already hold this row from an earlier read; it must show the new amount.
        result = await self.session.execute(statement, execution_options={"populate_existing": True})
        return result.scalar_one()

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
