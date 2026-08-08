from langchain_core.tools import tool

from ai_service.core.context import get_db_session
from ai_service.services.category_service import CategoryService


@tool
async def get_categories(type: str | None = None) -> dict:
    """List the known transaction categories.

    Returns all expense and income categories with their ids, names, icons,
    and colors. Use this to find a valid ``category`` name before calling
    add_transaction, or to explain how a user's spending is grouped.
    ``type`` is 'expense' or 'income' (optional; omitting returns both).
    """
    session = get_db_session()
    service = CategoryService(session)
    return await service.list_categories(type=type)
