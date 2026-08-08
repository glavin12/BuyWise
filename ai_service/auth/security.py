from __future__ import annotations

import logging
from typing import Any

import jwt
from jwt import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidTokenError as PyJWTInvalidTokenError,
    PyJWKClientError,
)

from ai_service.auth.exceptions import (
    ExpiredTokenError,
    InvalidTokenError as AppInvalidTokenError,
)
from ai_service.auth.jwks import get_jwks_client
from ai_service.core.config import get_settings

logger = logging.getLogger(__name__)


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify a Supabase access token (JWT) and return its claims.

    Verification performed:
      * Signature: validated against the project's JWKS (RS256) — no HS256
        shared secret is ever held by this service.
      * Issuer (``iss``): must equal ``settings.jwt_issuer``.
      * Audience (``aud``): must equal ``SUPABASE_JWT_AUDIENCE`` (default
        ``"authenticated"``).
      * Expiration (``exp``): enforced by PyJWT automatically.

    Raises:
        ExpiredTokenError: the token's ``exp`` has passed.
        InvalidTokenError: signature/issuer/audience/claims invalid, the
            ``kid`` is absent, or no matching JWKS key was found.
    """
    settings = get_settings()
    issuer = settings.jwt_issuer
    if not issuer:
        raise AppInvalidTokenError("Auth is not configured: SUPABASE_URL is missing.")

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token).key
    except PyJWKClientError as exc:
        logger.warning("JWKS lookup failed: %s", exc)
        raise AppInvalidTokenError("Token signature could not be verified.") from exc
    except PyJWTInvalidTokenError as exc:
        logger.warning("JWT could not be parsed: %s", exc)
        raise AppInvalidTokenError("Invalid authentication token.") from exc

    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=settings.jwt_algorithms_list,
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=issuer,
            options={"require": ["exp", "iss", "iat", "sub"]},
        )
    except ExpiredSignatureError as exc:
        raise ExpiredTokenError() from exc
    except (InvalidIssuerError, InvalidAudienceError) as exc:
        logger.warning("JWT issuer/audience mismatch: %s", exc)
        raise AppInvalidTokenError("Token issuer or audience is invalid.") from exc
    except PyJWTInvalidTokenError as exc:
        logger.warning("JWT rejected: %s", exc)
        raise AppInvalidTokenError("Invalid authentication token.") from exc