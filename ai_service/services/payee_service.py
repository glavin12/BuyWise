from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import PayeeRepository


class PayeeNotFoundError(LookupError):
    pass


class PayeeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.payees = PayeeRepository(session)

    async def create_payee(self, user_id: uuid.UUID, name: str) -> dict:
        self._validate_name(name)
        payee = await self.payees.create(user_id, name)
        await self.session.commit()
        return self._to_dict(payee)

    async def list_payees(self, user_id: uuid.UUID) -> list[dict]:
        return [self._to_dict(payee) for payee in await self.payees.list(user_id)]

    async def get_payee(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> dict:
        payee = await self.payees.get(user_id, payee_id)
        if payee is None:
            raise PayeeNotFoundError("Payee not found")
        return self._to_dict(payee)

    async def update_payee(self, user_id: uuid.UUID, payee_id: uuid.UUID, name: str) -> dict:
        self._validate_name(name)
        payee = await self.payees.update(user_id, payee_id, name)
        if payee is None:
            raise PayeeNotFoundError("Payee not found")
        await self.session.commit()
        return self._to_dict(payee)

    async def delete_payee(self, user_id: uuid.UUID, payee_id: uuid.UUID) -> bool:
        deleted = await self.payees.delete(user_id, payee_id)
        if not deleted:
            raise PayeeNotFoundError("Payee not found")
        await self.session.commit()
        return True

    @staticmethod
    def _validate_name(name: str) -> None:
        if not name or not name.strip():
            raise ValueError("name is required")

    @staticmethod
    def _to_dict(payee) -> dict:
        return {
            "id": str(payee.id),
            "name": payee.name,
            "normalized_name": payee.normalized_name,
            "created_at": payee.created_at.isoformat() if payee.created_at else None,
            "updated_at": payee.updated_at.isoformat() if payee.updated_at else None,
        }
