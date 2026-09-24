from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError as PyJWTInvalidTokenError

from ai_service.auth.exceptions import (
    InvalidTokenError,
    NoAuthorizationError,
)
from ai_service.auth.schemas import CurrentUser
from ai_service.auth.security import verify_access_token

logger = logging.getLogger(__name__)

# auto_error=False so we raise our own typed AuthError (mapped to 401 by the
# global handler) rather than FastAPI's default 403.
_bearer_scheme = HTTPBearer(auto_error=False)


def _claim_to_uuid(value: Any) -> UUID | None:
    """Best-effort coercion of a JWT claim to ``UUID``; ``None`` if absent/invalid."""
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    """Resolve the authenticated user from the request's Bearer JWT.

    Deliberately a plain ``def``: FastAPI runs it in its threadpool, so the
    blocking JWKS fetch inside ``verify_access_token`` (a sync PyJWKClient
    urllib call on cache miss) cannot stall the event loop for every user.

    Flow:
      1. Extract the Bearer token from the Authorization header.
      2. Verify the Supabase JWT (signature, issuer, audience, expiration).
      3. Map the verified ``sub`` (and optional email/role/session_id)
         claims to a :class:`CurrentUser`.

    The returned ``CurrentUser.id`` is the ONLY ``user_id`` the application
    trusts. Routers must never accept ``user_id`` from a body/path/query.

    Raises:
        NoAuthorizationError: header missing or not Bearer.
        InvalidTokenError: verification failed (mapped from JWT lib errors
            surfaced by :func:`verify_access_token`).
    """
    if credentials is None or not credentials.credentials:
        raise NoAuthorizationError()
    token = credentials.credentials

    try:
        claims = verify_access_token(token)
    except InvalidTokenError:
        raise
    except PyJWTInvalidTokenError as exc:
        raise InvalidTokenError(str(exc)) from exc

    user_id = _claim_to_uuid(claims.get("sub"))
    if user_id is None:
        raise InvalidTokenError("Token is missing a valid subject (sub) claim.")

    email = claims.get("email")
    role = claims.get("role")
    if not isinstance(email, (str, type(None))):
        email = None
    if not isinstance(role, (str, type(None))):
        role = None

    return CurrentUser(
        id=user_id,
        email=email,
        role=role,
        session_id=_claim_to_uuid(claims.get("session_id")),
    )