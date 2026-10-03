from __future__ import annotations

import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import BudgetEntry, Category, Conversation, Goal, Message, Payee, Profile, Transaction

# Child to parent. The database cascades from ``profiles``, but conversations have no foreign key to it,
# ``transactions.category_id`` is RESTRICT and the SQLite test database enforces no foreign keys, so
# every table is cleared explicitly and in this order.
_OWNED = (Message, Conversation, Transaction, BudgetEntry, Goal, Payee, Category)


class AccountRepository:
    """Removes everything one user owns."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def delete_user_data(self, user_id: uuid.UUID) -> None:
        """Delete the user's rows (messages included, soft-deleted ones too) and then the profile.

        Safe to repeat: with nothing left every statement deletes zero rows. The caller commits.
        """
        for model in _OWNED:
            await self.session.execute(delete(model).where(model.user_id == user_id))
        await self.session.execute(delete(Profile).where(Profile.id == user_id))
