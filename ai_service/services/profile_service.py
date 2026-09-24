from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.models import Profile
from ai_service.repositories import CategoryRepository, PayeeRepository, ProfileRepository


class ProfileNotFoundError(LookupError):
    """Raised when no profile exists for the user yet (not onboarded)."""


class ProfileService:
    """Business logic for user profiles.

    Profiles are created/updated through the UI onboarding flow (router path).
    The AI tool path is read-only: it only ever needs the profile for context.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.profiles = ProfileRepository(session)
        self.categories = CategoryRepository(session)
        self.payees = PayeeRepository(session)

    async def get_profile(self, user_id: uuid.UUID) -> Profile | None:
        return await self.profiles.get(user_id)

    async def require_profile(self, user_id: uuid.UUID) -> Profile:
        profile = await self.profiles.get(user_id)
        if profile is None:
            raise ProfileNotFoundError("Profile not found")
        return profile

    async def create_profile(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None = None,
        currency: str | None = None,
        income_type: str | None = None,
        salary_day: int | None = None,
        savings_target_percent: int | None = None,
        investment_style: str | None = None,
        budget_alerts: bool | None = None,
        onboarding_complete: bool = False,
        timezone: str | None = None,
    ) -> Profile:
        try:
            profile = await self._create_profile(
                user_id,
                full_name=full_name,
                currency=currency,
                income_type=income_type,
                salary_day=salary_day,
                savings_target_percent=savings_target_percent,
                investment_style=investment_style,
                budget_alerts=budget_alerts,
                onboarding_complete=onboarding_complete,
                timezone=timezone,
            )
            await self.session.commit()
        except IntegrityError:
            # A concurrent first request created the profile: first login is
            # idempotent, so hand back the winner's row.
            # ponytail: the loser's payload is not re-applied; only two first
            # requests racing (e.g. parallel GET /profile) can lose it.
            await self.session.rollback()
            profile = await self.profiles.get(user_id)
            if profile is None:
                raise
        return profile

    async def ensure_profile(self, user_id: uuid.UUID) -> Profile:
        """Create the default profile graph when a user has not onboarded yet."""
        profile = await self.get_profile(user_id)
        if profile is not None:
            return profile
        return await self._create_profile(user_id)

    async def _create_profile(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None = None,
        currency: str | None = None,
        income_type: str | None = None,
        salary_day: int | None = None,
        savings_target_percent: int | None = None,
        investment_style: str | None = None,
        budget_alerts: bool | None = None,
        onboarding_complete: bool = False,
        timezone: str | None = None,
    ) -> Profile:
        profile = await self.profiles.create(
            user_id,
            full_name=full_name,
            currency=currency or "INR",
            income_type=income_type,
            salary_day=salary_day,
            savings_target_percent=savings_target_percent,
            investment_style=investment_style,
            budget_alerts=budget_alerts if budget_alerts is not None else True,
            onboarding_complete=onboarding_complete,
            timezone=timezone or "Asia/Kolkata",
        )
        await self.categories.seed_defaults(user_id)
        await self.payees.seed_defaults(user_id)
        return profile

    async def update_profile(
        self,
        user_id: uuid.UUID,
        **fields,
    ) -> Profile | None:
        """Partial update; returns ``None`` when the user has no profile."""
        profile = await self.profiles.update(user_id, **fields)
        if profile is not None:
            await self.session.commit()
        return profile

    async def profile_snapshot(self, user_id: uuid.UUID) -> dict | None:
        """Tool-facing dict. Returns ``None`` before onboarding."""
        profile = await self.profiles.get(user_id)
        if profile is None:
            return None
        return {
            "full_name": profile.full_name,
            "currency": profile.currency,
            "income_type": profile.income_type,
            "salary_day": profile.salary_day,
            "timezone": profile.timezone,
            "onboarding_complete": profile.onboarding_complete,
            "savings_target_percent": profile.savings_target_percent,
            "investment_style": profile.investment_style,
            "budget_alerts": profile.budget_alerts,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
        }
