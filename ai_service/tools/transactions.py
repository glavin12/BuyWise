from datetime import date
from uuid import UUID

from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.repositories import AccountRepository, CategoryRepository
from ai_service.services.transaction_service import (
    AccountReferenceError,
    CategoryNotFoundError,
    PayeeReferenceError,
    TransactionService,
)
from ai_service.utils.financial import amount_to_minor


@tool
async def get_recent_transactions(
    limit: int = 10,
    period: str | None = None,
    category: str | None = None,
    transaction_type: str | None = None,
) -> dict:
    """List recent user transactions with account, payee, category, and date."""
    user_id = get_current_user_id()
    session = get_db_session()
    category_id = None
    if category is not None:
        category_row = await CategoryRepository(session).find_by_name(
            user_id, category, transaction_type or "expense"
        )
        if category_row is None:
            return {"status": "error", "message": f"Category '{category}' not found."}
        category_id = category_row.id
    return await TransactionService(session).list_transactions(
        user_id,
        limit=max(1, min(limit, 100)),
        period=period,
        category_id=category_id,
        transaction_type=transaction_type,
    )


@tool
async def add_transaction(
    amount: float,
    category: str,
    transaction_type: str = "expense",
    account_id: str | None = None,
    payee: str | None = None,
    description: str | None = None,
    notes: str | None = None,
    transaction_date: str | None = None,
    cleared_status: str = "pending",
) -> dict:
    """Record an expense, income, or starting balance in minor-unit storage.

    Amounts are supplied as normal currency values and converted exactly before
    persistence. The first active account is used when account_id is omitted.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    accounts = AccountRepository(session)
    try:
        account = await accounts.get_default(user_id) if account_id is None else await accounts.get(user_id, UUID(account_id))
        if account is None:
            return {"status": "error", "message": "No active account is available."}
        parsed_date = date.fromisoformat(transaction_date) if transaction_date else date.today()
        return await TransactionService(session).add_transaction(
            user_id,
            account_id=account.id,
            amount=amount_to_minor(amount),
            category_name=category,
            transaction_type=transaction_type,
            payee_name=payee,
            description=description,
            notes=notes,
            transaction_date=parsed_date,
            cleared_status=cleared_status,
        )
    except (ValueError, AccountReferenceError, CategoryNotFoundError, PayeeReferenceError) as exc:
        return {"status": "error", "message": str(exc)}
