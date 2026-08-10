from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.account_service import AccountService


@tool
async def get_accounts() -> dict:
    """List active accounts and their ledger balances."""
    accounts = await AccountService(get_db_session()).list_accounts(get_current_user_id())
    return {"count": len(accounts), "accounts": accounts}
