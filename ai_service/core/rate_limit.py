from __future__ import annotations

import hashlib

from slowapi import Limiter
from starlette.requests import Request
from slowapi.util import get_remote_address

from ai_service.core.config import get_settings

settings = get_settings()


def _get_rate_limit_key(request: Request) -> str:
    """Build a throttling key; this is never used for authorization.

    Only server-verifiable inputs are used: a client-chosen header such as
    ``X-User-ID`` would let a caller mint a fresh bucket on every request.
    """
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() == "bearer" and token:
        return f"token:{hashlib.sha256(token.encode()).hexdigest()[:32]}"

    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_get_rate_limit_key, headers_enabled=True)
limiter.enabled = settings.RATE_LIMIT_ENABLED
