from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Account


class AccountRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        *,
        name: str,
        account_type: str,
        currency: str = "INR",
    ) -> Account:
        account = Account(
            user_id=user_id,
            name=name.strip(),
            account_type=account_type,
            currency=currency,
        )
        self.session.add(account)
        await self.session.flush()
        return account

    async def list(self, user_id: uuid.UUID, *, active_only: bool = True) -> list[Account]:
        stmt = select(Account).where(Account.user_id == user_id)
        if active_only:
            stmt = stmt.where(Account.is_active.is_(True))
        result = await self.session.scalars(stmt.order_by(Account.created_at.asc(), Account.id.asc()))
        return list(result)

    async def get_default(self, user_id: uuid.UUID) -> Account | None:
        return await self.session.scalar(
            select(Account)
            .where(Account.user_id == user_id, Account.is_active.is_(True))
            .order_by(Account.created_at.asc(), Account.id.asc())
            .limit(1)
        )

    async def get(self, user_id: uuid.UUID, account_id: uuid.UUID) -> Account | None:
        return await self.session.scalar(
            select(Account).where(Account.user_id == user_id, Account.id == account_id)
        )

    async def update(self, user_id: uuid.UUID, account_id: uuid.UUID, **fields) -> Account | None:
        account = await self.get(user_id, account_id)
        if account is None:
            return None
        for field, value in fields.items():
            if value is not None and field == "name":
                value = value.strip()
            setattr(account, field, value)
        await self.session.flush()
        return account

    async def delete(self, user_id: uuid.UUID, account_id: uuid.UUID) -> bool:
        account = await self.get(user_id, account_id)
        if account is None:
            return False
        account.is_active = False
        await self.session.flush()
        return True
