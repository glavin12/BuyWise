from langchain_core.tools import tool

from ai_service.core.context import get_current_user_id, get_db_session
from ai_service.services.profile_service import ProfileService


@tool
async def get_profile() -> dict:
    """Get the user's financial profile and preferences.

    Returns name, currency, income type, salary day, savings target percent,
    investment style, budget alert preference, and onboarding status. Use this
    when the user asks about their profile, preferences, salary day, currency,
    or income type. Returns a not_onboarded status if the user has not
    completed profile onboarding.
    """
    user_id = get_current_user_id()
    session = get_db_session()
    service = ProfileService(session)
    snapshot = await service.profile_snapshot(user_id)
    if snapshot is None:
        return {"status": "not_onboarded", "message": "User has not completed profile onboarding."}
    return snapshot
