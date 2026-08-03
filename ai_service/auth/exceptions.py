from __future__ import annotations


class AuthError(Exception):
    """Base class for all authentication failures.

    Mapped to HTTP 401 by the global exception handler in ``main.py``.
    The ``detail`` is safe to return to the client; never embed secrets.
    """

    detail: str = "Authentication failed."

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.detail)
        if detail is not None:
            self.detail = detail


class NoAuthorizationError(AuthError):
    """No Authorization header present, or not a Bearer scheme."""

    detail = "Authorization header missing or not a Bearer token."


class InvalidTokenError(AuthError):
    """Token signature, issuer, audience, or claims are invalid."""

    detail = "Invalid authentication token."


class ExpiredTokenError(AuthError):
    """Token has passed its ``exp`` claim."""

    detail = "Authentication token has expired."