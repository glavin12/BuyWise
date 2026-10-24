from __future__ import annotations

import logging
from typing import Any

import jwt
from jwt import (
    ExpiredSignatureError,
    ImmatureSignatureError,
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


def _key_id_from_header(token: str, allowed_algorithms: list[str]) -> str:
    """Return the unverified header's ``kid``, refusing early any token that can never verify.

    These checks need no key, so a forged token (``alg: none``, an HS256 token
    signed with the public key as its secret, a made-up ``kid``) is turned away
    before it can cost a key lookup or a JWKS fetch.
    """
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTInvalidTokenError as exc:
        logger.warning("JWT could not be parsed: %s", exc)
        raise AppInvalidTokenError("Invalid authentication token.") from exc

    alg = header.get("alg")
    if alg not in allowed_algorithms:
        logger.warning("JWT rejected: algorithm %.40r is not allowed", alg)
        raise AppInvalidTokenError("Invalid authentication token.")
    kid = header.get("kid")
    if not isinstance(kid, str) or not kid:
        logger.warning("JWT rejected: the header has no usable kid")
        raise AppInvalidTokenError("Invalid authentication token.")
    return kid


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify a Supabase access token (JWT) and return its claims.

    Verification performed:
      * Header: ``alg`` must be one of ``SUPABASE_JWT_ALGORITHMS`` and ``kid``
        must be present, checked before any key lookup.
      * Signature: validated against the project's JWKS (ES256/RS256) — no
        HS256 shared secret is ever held by this service. The signing key must
        also be of the algorithm the header names.
      * Issuer (``iss``): must equal ``settings.jwt_issuer``.
      * Audience (``aud``): must equal ``SUPABASE_JWT_AUDIENCE`` (default
        ``"authenticated"``).
      * Expiration (``exp``) and issue time (``iat``): enforced by PyJWT, with
        ``JWT_LEEWAY_SECONDS`` of allowance for clocks that differ a little.

    Raises:
        ExpiredTokenError: the token's ``exp`` has passed.
        InvalidTokenError: signature/issuer/audience/claims invalid, the
            ``alg`` is not allowed, the ``kid`` is absent, or no matching JWKS
            key was found.
    """
    settings = get_settings()
    issuer = settings.jwt_issuer
    if not issuer:
        raise AppInvalidTokenError("Auth is not configured: SUPABASE_URL is missing.")

    kid = _key_id_from_header(token, settings.jwt_algorithms_list)
    try:
        signing_key = get_jwks_client().get_signing_key(kid)
    except PyJWKClientError as exc:
        logger.warning("JWKS lookup failed: %s", exc)
        raise AppInvalidTokenError("Token signature could not be verified.") from exc

    try:
        # The PyJWK itself, not its bare key: PyJWT then insists the token's alg matches the key's type,
        # so an RS256 header naming an EC key is a clean rejection instead of a crypto-layer error.
        return jwt.decode(
            token,
            signing_key,
            algorithms=settings.jwt_algorithms_list,
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=issuer,
            leeway=settings.JWT_LEEWAY_SECONDS,
            options={"require": ["exp", "iss", "iat", "sub"]},
        )
    except ExpiredSignatureError as exc:
        raise ExpiredTokenError() from exc
    except ImmatureSignatureError as exc:
        logger.warning(
            "JWT not yet valid: the server clock may be behind the issuer's (leeway %ss): %s",
            settings.JWT_LEEWAY_SECONDS,
            exc,
        )
        raise AppInvalidTokenError("Invalid authentication token.") from exc
    except (InvalidIssuerError, InvalidAudienceError) as exc:
        logger.warning("JWT issuer/audience mismatch: %s", exc)
        raise AppInvalidTokenError("Token issuer or audience is invalid.") from exc
    except PyJWTInvalidTokenError as exc:
        logger.warning("JWT rejected: %s", exc)
        raise AppInvalidTokenError("Invalid authentication token.") from exc