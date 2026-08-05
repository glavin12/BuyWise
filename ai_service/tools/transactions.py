from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.transaction_service import (
    CategoryNotFoundError,
    TransactionService,
)


@tool
async def get_recent_transactions(
    limit: int = 10,
    period: str | None = None,
    category: str | None = None,
    type: str | None = None,
) -> dict:
    """List the user's recent transactions.

    Returns the most recent transactions with title, merchant, amount, type,
    category, payment method, and date. Optionally filter by ``period``
    ('this_month'/'last_month'), ``category`` (category name), or ``type``
    ('expense'/'income'). Use this when the user asks to see their
    transactions or a specific past purchase.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = TransactionService(session)

    category_id = None
    if category is not None:
        from ai_service.repositories import CategoryRepository

        repo = CategoryRepository(session)
        cat = await repo.find_by_name(category, type or "expense")
        if cat is None:
            return {
                "status": "error",
                "message": f"Category '{category}' not found for type '{type or 'expense'}'.",
            }
        category_id = cat.id

    return await service.list_transactions(
        user_id,
        limit=limit,
        period=period,
        category_id=category_id,
        type=type,
    )


@tool
async def add_transaction(
    title: str,
    amount: float,
    category: str,
    type: str = "expense",
    merchant_name: str | None = None,
    description: str | None = None,
    payment_method: str | None = None,
    is_recurring: bool = False,
) -> dict:
    """Add a new financial transaction for the user.

    ``title`` is a short description (e.g. 'Swiggy order'). ``amount`` is a
    positive number. ``type`` is 'expense' (default) or 'income'. ``category``
    must be one of the user's known category names — use get_categories to see
    valid options. Use this when the user asks to log an expense or income.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = TransactionService(session)
    try:
        return await service.add_transaction(
            user_id,
            title=title,
            amount=amount,
            category_name=category,
            type=type,
            merchant_name=merchant_name,
            description=description,
            payment_method=payment_method,
            is_recurring=is_recurring,
        )
    except CategoryNotFoundError as exc:
        return {"status": "error", "message": str(exc)}
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
