from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Payee


class PayeeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, name: str) -> Payee:
        clean_name = name.strip()
        payee = Payee(user_id=user_id, name=clean_name, normalized_name=clean_name.lower())
        self.session.add(payee)
        await self.session.flush()
        return payee

    async def list(self, user_id: uuid.UUID) -> list[Payee]:
        result = await self.session.scalars(
            select(Payee).where(Payee.user_id == user_id).order_by(Payee.name, Payee.id)
        )
        return list(result)

    async def get(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> Payee | None:
        return await self.session.scalar(
            select(Payee).where(Payee.user_id == user_id, Payee.id == payee_id)
        )

    async def update(self, user_id: uuid.UUID, payee_id: uuid.UUID, name: str) -> Payee | None:
        payee = await self.get(user_id, payee_id)
        if payee is None:
            return None
        clean_name = name.strip()
        payee.name = clean_name
        payee.normalized_name = clean_name.lower()
        await self.session.flush()
        return payee

    async def delete(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> bool:
        payee = await self.get(user_id, payee_id)
        if payee is None:
            return False
        await self.session.delete(payee)
        await self.session.flush()
        return True

    async def find_or_create(self, user_id: uuid.UUID, name: str) -> Payee:
        normalized_name = name.strip().lower()
        existing = await self.session.scalar(
            select(Payee).where(
                Payee.user_id == user_id,
                Payee.normalized_name == normalized_name,
            )
        )
        if existing is not None:
            return existing
        try:
            async with self.session.begin_nested():
                payee = Payee(
                    user_id=user_id,
                    name=name.strip(),
                    normalized_name=normalized_name,
                )
                self.session.add(payee)
                await self.session.flush()
            return payee
        except IntegrityError:
            return await self.session.scalar(
                select(Payee).where(
                    Payee.user_id == user_id,
                    Payee.normalized_name == normalized_name,
                )
            )
