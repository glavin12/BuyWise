from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.repositories import AccountRepository, TransactionRepository


class TransferService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.accounts = AccountRepository(session)
        self.transactions = TransactionRepository(session)

    async def create_transfer(
        self,
        user_id: uuid.UUID,
        *,
        from_account_id: uuid.UUID,
        to_account_id: uuid.UUID,
        amount: int,
        transaction_date: date | None = None,
        description: str | None = None,
    ) -> dict:
        if amount <= 0:
            raise ValueError("amount must be positive")
        if from_account_id == to_account_id:
            raise ValueError("source and destination accounts must differ")
        from_account = await self.accounts.get(user_id, from_account_id)
        to_account = await self.accounts.get(user_id, to_account_id)
        if from_account is None or not from_account.is_active:
            raise ValueError("source account not found")
        if to_account is None or not to_account.is_active:
            raise ValueError("destination account not found")
        if from_account.currency != to_account.currency:
            raise ValueError("transfers require matching account currencies")

        group_id = uuid.uuid4()
        transfer_date = transaction_date or date.today()
        outgoing = await self.transactions.create(
            user_id,
            account_id=from_account_id,
            category_id=None,
            payee_id=None,
            amount=amount,
            currency=from_account.currency,
            transaction_type="transfer",
            transaction_date=transfer_date,
            description=description,
            cleared_status="cleared",
            transfer_group_id=group_id,
            transfer_direction="out",
        )
        incoming = await self.transactions.create(
            user_id,
            account_id=to_account_id,
            category_id=None,
            payee_id=None,
            amount=amount,
            currency=to_account.currency,
            transaction_type="transfer",
            transaction_date=transfer_date,
            description=description,
            cleared_status="cleared",
            transfer_group_id=group_id,
            transfer_direction="in",
        )
        await self.session.commit()
        return {
            "transfer_group_id": str(group_id),
            "amount": amount,
            "from_account_id": str(outgoing.account_id),
            "to_account_id": str(incoming.account_id),
            "transaction_date": transfer_date.isoformat(),
            "description": description,
        }

    async def delete_transfer(self, user_id: uuid.UUID, transfer_group_id: uuid.UUID) -> bool:
        transactions = await self.transactions.get_transfer_group(user_id, transfer_group_id)
        if not transactions:
            return False
        for transaction in transactions:
            await self.session.delete(transaction)
        await self.session.commit()
        return True
