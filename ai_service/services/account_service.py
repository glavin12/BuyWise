from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Account
from ai_service.repositories import AccountRepository, TransactionRepository
from ai_service.services.profile_service import ProfileService
from ai_service.utils.financial import minor_to_amount


class AccountNotFoundError(LookupError):
    pass


class AccountService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.accounts = AccountRepository(session)
        self.transactions = TransactionRepository(session)
        self.profiles = ProfileService(session)

    async def create_account(
        self,
        user_id: uuid.UUID,
        *,
        name: str,
        account_type: str,
        currency: str = "INR",
        starting_balance: int | None = None,
    ) -> dict:
        self._validate_name(name)
        if starting_balance is not None and starting_balance < 0:
            raise ValueError("starting_balance must be non-negative")
        await self.profiles.ensure_profile(user_id)
        account = await self.accounts.create(
            user_id, name=name, account_type=account_type, currency=currency
        )
        if starting_balance:
            await self.transactions.create(
                user_id,
                account_id=account.id,
                category_id=None,
                payee_id=None,
                amount=starting_balance,
                currency=currency,
                transaction_type="starting_balance",
                transaction_date=date.today(),
                cleared_status="cleared",
            )
        await self.session.commit()
        return await self.get_account(user_id, account.id)

    async def list_accounts(self, user_id: uuid.UUID) -> list[dict]:
        accounts = await self.accounts.list(user_id)
        return [await self._account_to_dict(user_id, account) for account in accounts]

    async def get_account(self, user_id: uuid.UUID, account_id: uuid.UUID) -> dict:
        account = await self.accounts.get(user_id, account_id)
        if account is None or not account.is_active:
            raise AccountNotFoundError("Account not found")
        return await self._account_to_dict(user_id, account)

    async def update_account(self, user_id: uuid.UUID, account_id: uuid.UUID, **fields) -> dict:
        account = await self.accounts.get(user_id, account_id)
        if account is None or not account.is_active:
            raise AccountNotFoundError("Account not found")
        if "name" in fields:
            self._validate_name(fields["name"])
        account = await self.accounts.update(user_id, account_id, **fields)
        await self.session.commit()
        return await self._account_to_dict(user_id, account)

    async def delete_account(self, user_id: uuid.UUID, account_id: uuid.UUID) -> bool:
        account = await self.accounts.get(user_id, account_id)
        if account is None or not account.is_active:
            raise AccountNotFoundError("Account not found")
        deleted = await self.accounts.delete(user_id, account_id)
        await self.session.commit()
        return deleted

    async def _account_to_dict(self, user_id: uuid.UUID, account: Account) -> dict:
        balance = await self.transactions.get_balance(user_id, account.id)
        return {
            "id": str(account.id),
            "name": account.name,
            "account_type": account.account_type,
            "currency": account.currency,
            "is_active": account.is_active,
            "balance": balance,
            "display_balance": minor_to_amount(balance),
            "created_at": account.created_at.isoformat() if account.created_at else None,
            "updated_at": account.updated_at.isoformat() if account.updated_at else None,
        }

    @staticmethod
    def _validate_name(name: str) -> None:
        if not name or not name.strip():
            raise ValueError("name is required")
