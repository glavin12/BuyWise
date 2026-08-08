from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.auth import CurrentUser, get_current_user
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import get_async_session
from ai_service.schemas.profile import ProfileRead, ProfileUpdate
from ai_service.services.profile_service import ProfileService

router = APIRouter(prefix="/api/v1", tags=["profile"])
settings = get_settings()


@router.get("/profile", response_model=ProfileRead)
@limiter.limit(settings.PROFILE_RATE_LIMIT)
async def get_profile(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the authenticated user's profile.

    The profile id is derived from the verified JWT, never the request.
    """
    service = ProfileService(session)
    profile = await service.get_profile(current_user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profile", response_model=ProfileRead)
@limiter.limit(settings.PROFILE_RATE_LIMIT)
async def upsert_profile(
    request: Request,
    response: Response,
    body: ProfileUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create or update the authenticated user's profile (onboarding form).

    Partial updates: only fields provided are changed. If no profile exists
    yet, one is created with ``onboarding_complete`` set to the provided value
    (defaults to true when the form submits the full set).
    """
    service = ProfileService(session)
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="No profile fields provided")

    existing = await service.get_profile(current_user.id)
    if existing is None:
        profile = await service.create_profile(
            current_user.id,
            onboarding_complete=data.pop("onboarding_complete", True),
            **data,
        )
    else:
        profile = await service.update_profile(current_user.id, **data)
    return profile
