from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Transaction
from ai_service.repositories import (
    CategoryRepository,
    PayeeRepository,
    ProfileRepository,
    TransactionRepository,
)
from ai_service.schemas.financial import TransactionResponse
from ai_service.utils.financial import resolve_period


class CategoryNotFoundError(LookupError):
    pass


class TransactionNotFoundError(LookupError):
    pass


class PayeeReferenceError(LookupError):
    pass


class TransactionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transactions = TransactionRepository(session)
        self.categories = CategoryRepository(session)
        self.payees = PayeeRepository(session)
        self.profiles = ProfileRepository(session)

    async def list_transactions(self, user_id: uuid.UUID, **filters) -> dict:
        period = filters.pop("period", None)
        if period is not None:
            window = resolve_period(period)
            filters.setdefault("date_from", window.start)
            filters.setdefault("date_to", window.end - timedelta(days=1))
        limit = filters.pop("limit", 20)
        offset = filters.pop("offset", 0)
        rows = await self.transactions.list(user_id, limit=limit, offset=offset, **filters)
        total = await self.transactions.count(user_id, **filters)
        return {
            "period": period or "all",
            "count": len(rows),
            "total": total,
            "limit": limit,
            "offset": offset,
            "transactions": [self._transaction_to_dict(row) for row in rows],
        }

    async def add_transaction(
        self,
        user_id: uuid.UUID,
        *,
        amount: int,
        transaction_type: str,
        category_id: uuid.UUID | None = None,
        category_name: str | None = None,
        payee_id: uuid.UUID | None = None,
        payee_name: str | None = None,
        payment_method: str | None = None,
        currency: str | None = None,
        transaction_date: date | None = None,
        description: str | None = None,
        notes: str | None = None,
        cleared_status: str = "pending",
    ) -> dict:
        self._validate_amount(amount)
        if transaction_type not in {"expense", "income", "starting_balance"}:
            raise ValueError("transaction_type must be expense, income, or starting_balance")
        category = await self._resolve_category(
            user_id, category_id, category_name, transaction_type
        )
        payee = await self._resolve_payee(user_id, payee_id, payee_name, transaction_type)
        if transaction_type in {"expense", "income"} and category is None:
            raise CategoryNotFoundError("A category is required for expense and income transactions")
        if currency is None:
            # Default to the user's profile currency (the ledger is single-currency).
            profile = await self.profiles.get(user_id)
            currency = profile.currency if profile else "INR"
        transaction = await self.transactions.create(
            user_id,
            category_id=category.id if category else None,
            payee_id=payee.id if payee else None,
            amount=amount,
            currency=currency,
            transaction_type=transaction_type,
            payment_method=payment_method,
            transaction_date=transaction_date or date.today(),
            description=description,
            notes=notes,
            cleared_status=cleared_status,
        )
        await self.session.commit()
        result = await self.transactions.get(user_id, transaction.id)
        return self._transaction_to_dict(result or transaction)

    async def get_transaction(self, user_id: uuid.UUID, transaction_id: uuid.UUID) -> dict:
        transaction = await self.transactions.get(user_id, transaction_id)
        if transaction is None:
            raise TransactionNotFoundError("Transaction not found")
        return self._transaction_to_dict(transaction)

    async def update_transaction(
        self, user_id: uuid.UUID, transaction_id: uuid.UUID, **fields
    ) -> dict:
        current = await self.transactions.get(user_id, transaction_id)
        if current is None:
            raise TransactionNotFoundError("Transaction not found")
        if "amount" in fields:
            self._validate_amount(fields["amount"])
        if "category_id" in fields and fields["category_id"] is not None:
            category = await self.categories.get(user_id, fields["category_id"])
            if category is None or not category.is_active:
                raise CategoryNotFoundError("Category not found")
        if "payee_id" in fields and fields["payee_id"] is not None:
            if await self.payees.get(user_id, fields["payee_id"]) is None:
                raise PayeeReferenceError("Payee not found")
        merged_type = fields.get("transaction_type", current.transaction_type)
        merged_category = fields.get("category_id", current.category_id)
        merged_payee = fields.get("payee_id", current.payee_id)
        if merged_type in {"expense", "income"}:
            if merged_category is None:
                raise CategoryNotFoundError("A category is required for expense and income transactions")
            # Same type rules as create. Only when one of these three changed:
            # an unrelated edit must not be blocked by a row that predates them.
            if fields.keys() & {"transaction_type", "category_id", "payee_id"}:
                category = await self.categories.get(user_id, merged_category)
                if category is not None and category.type != merged_type:
                    raise CategoryNotFoundError("Category type does not match transaction type")
                if merged_payee is not None:
                    payee = await self.payees.get(user_id, merged_payee)
                    if payee is not None and payee.type != merged_type:
                        raise PayeeReferenceError("Payee type does not match transaction type")
        transaction = await self.transactions.update(user_id, transaction_id, **fields)
        await self.session.commit()
        return self._transaction_to_dict(transaction)

    async def delete_transaction(self, user_id: uuid.UUID, transaction_id: uuid.UUID) -> bool:
        deleted = await self.transactions.delete(user_id, transaction_id)
        if not deleted:
            raise TransactionNotFoundError("Transaction not found")
        await self.session.commit()
        return True

    async def _resolve_category(
        self,
        user_id: uuid.UUID,
        category_id: uuid.UUID | None,
        category_name: str | None,
        transaction_type: str,
    ):
        if category_id is not None:
            category = await self.categories.get(user_id, category_id)
            if category is None or not category.is_active:
                raise CategoryNotFoundError("Category not found")
            if category.type != transaction_type and transaction_type in {"expense", "income"}:
                raise CategoryNotFoundError("Category type does not match transaction type")
            return category
        if category_name is not None:
            category = await self.categories.find_by_name(user_id, category_name, transaction_type)
            if category is None:
                raise CategoryNotFoundError(f"Category '{category_name}' not found")
            return category
        return None

    async def _resolve_payee(self, user_id, payee_id, payee_name, transaction_type):
        if payee_id is not None:
            payee = await self.payees.get(user_id, payee_id)
            if payee is None:
                raise PayeeReferenceError("Payee not found")
            if payee.type != transaction_type and transaction_type in {"expense", "income"}:
                raise PayeeReferenceError("Payee type does not match transaction type")
            return payee
        if payee_name:
            return await self.payees.find_or_create(
                user_id, payee_name, transaction_type if transaction_type in {"expense", "income"} else "expense"
            )
        return None

    @staticmethod
    def _validate_amount(amount: int) -> None:
        if not isinstance(amount, int) or isinstance(amount, bool) or amount < 0:
            raise ValueError("amount must be a non-negative integer in minor units")

    @staticmethod
    def _transaction_to_dict(transaction: Transaction) -> dict:
        return TransactionResponse.model_validate(transaction).model_dump(mode="json")
