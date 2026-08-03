"""Authentication module for the BuyWise AI Service.

Supabase Auth is the single source of truth for authentication. This module
ONLY verifies Supabase-issued access tokens (JWTs, RS256/JWKS) and extracts
the authenticated identity. It never creates users, stores credentials, or
touches application tables.

Public surface:
    - :class:`CurrentUser`     — the authenticated identity injected into endpoints.
    - :func:`get_current_user` — FastAPI dependency that verifies the JWT.
    - :class:`AuthError`       — base exception for auth failures (mapped to 401).
"""
from __future__ import annotations

from ai_service.auth.dependencies import get_current_user
from ai_service.auth.exceptions import (
    AuthError,
    ExpiredTokenError,
    InvalidTokenError,
    NoAuthorizationError,
)
from ai_service.auth.schemas import CurrentUser, TokenPayload

__all__ = [
    "AuthError",
    "CurrentUser",
    "ExpiredTokenError",
    "InvalidTokenError",
    "NoAuthorizationError",
    "TokenPayload",
    "get_current_user",
]