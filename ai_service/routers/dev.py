"""Development-only utilities.

Registered ONLY when ``ENVIRONMENT == "development"`` (see ``main.py``). In
staging/production these routes are not mounted and return 404.

These helpers never authenticate users themselves — Supabase Auth remains the
sole authenticator. ``/dev/token`` simply relays credentials to Supabase
Auth's password-grant endpoint and returns the issued JWT so it can be pasted
into Swagger's Authorize button during local development.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ai_service.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dev", tags=["dev"])

SUPABASE_TOKEN_URL_TEMPLATE = "{base}/auth/v1/token?grant_type=password"


class DevTokenRequest(BaseModel):
    """Credentials for the dev token relay. Never stored."""

    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class DevTokenResponse(BaseModel):
    """Result of the Supabase password grant, trimmed for Swagger use."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: UUID
    email: str


@router.post("/token", response_model=DevTokenResponse)
async def dev_token(request: DevTokenRequest) -> DevTokenResponse:
    """Relay email/password to Supabase Auth and return the issued JWT.

    This endpoint performs NO authentication of its own. It forwards the
    credentials to Supabase Auth's password-grant endpoint using the project's
    anon (publishable) key and relays the resulting access token. Use the
    ``access_token`` in Swagger's Authorize dialog to act as that user.
    """
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be configured for /dev/token.")

    url = SUPABASE_TOKEN_URL_TEMPLATE.format(base=settings.SUPABASE_URL.rstrip("/"))
    payload = json.dumps({"email": request.email, "password": request.password}).encode("utf-8")
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    try:
        with urllib.request.urlopen(  # noqa: S310 — dev-only, fixed https URL
            urllib.request.Request(url, data=payload, headers=headers, method="POST"),
            timeout=15,
        ) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = _safe_error_detail(exc)
        logger.warning("Supabase password grant failed: %s", detail)
        raise RuntimeError(f"Supabase Auth rejected credentials: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Supabase Auth: {exc.reason}") from exc

    return DevTokenResponse(
        access_token=body["access_token"],
        token_type=body.get("token_type", "bearer"),
        expires_in=int(body.get("expires_in", 0)),
        user_id=UUID(body["user"]["id"]),
        email=body["user"].get("email", str(request.email)),
    )


def _safe_error_detail(exc: urllib.error.HTTPError) -> str:
    """Extract a non-sensitive message from a Supabase error response."""
    try:
        data = json.loads(exc.read().decode("utf-8"))
        return str(data.get("msg") or data.get("error_description") or data.get("error") or exc.reason)
    except (ValueError, OSError):
        return str(exc.reason)