"""Account deletion: the user's data first, then their Supabase Auth login."""

from __future__ import annotations

import asyncio
import logging
import urllib.error
import urllib.request
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.core.config import get_settings
from ai_service.repositories.account_repository import AccountRepository

logger = logging.getLogger(__name__)

ADMIN_TIMEOUT_SECONDS = 15


class AccountDeletionNotConfiguredError(RuntimeError):
    """No service-role key (or Supabase URL) is set, so the login could not be deleted. Nothing was deleted."""


class AuthUserDeletionError(RuntimeError):
    """The data is gone but Supabase Auth refused or did not answer. Repeating the request finishes the job."""


def _build_delete_request(base_url: str, key: str, user_id: uuid.UUID) -> urllib.request.Request:
    """``DELETE /auth/v1/admin/users/{id}`` (a hard delete: Supabase's ``should_soft_delete`` defaults to false).

    The key goes in ``apikey``. The legacy ``service_role`` key is a JWT and is also sent as a bearer token;
    the newer ``sb_secret_...`` keys are not JWTs and must not be.
    """
    headers = {"apikey": key}
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"
    return urllib.request.Request(
        f"{base_url.rstrip('/')}/auth/v1/admin/users/{user_id}", headers=headers, method="DELETE"
    )


def _delete_auth_user(base_url: str, key: str, user_id: uuid.UUID) -> None:
    """Blocking call: run it in a thread. A 404 means the login is already gone, which is the goal."""
    try:
        with urllib.request.urlopen(  # noqa: S310 — the URL is the configured Supabase project's https URL
            _build_delete_request(base_url, key, user_id), timeout=ADMIN_TIMEOUT_SECONDS
        ):
            pass
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return
        # Status only: neither the key nor the response body goes in the log.
        logger.error("Supabase Auth refused to delete a user: HTTP %s", exc.code)
        raise AuthUserDeletionError("Could not delete the login") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.error("Could not reach Supabase Auth to delete a user: %s", type(exc).__name__)
        raise AuthUserDeletionError("Could not delete the login") from exc


class AccountService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.accounts = AccountRepository(session)

    async def delete_account(self, user_id: uuid.UUID) -> None:
        settings = get_settings()
        key = settings.SUPABASE_SERVICE_ROLE_KEY
        if not key or not settings.SUPABASE_URL:
            # Checked first: deleting the data but leaving the login would strand the user.
            raise AccountDeletionNotConfiguredError("Account deletion is not configured")
        await self.accounts.delete_user_data(user_id)
        await self.session.commit()
        await asyncio.to_thread(_delete_auth_user, settings.SUPABASE_URL, key, user_id)
