from __future__ import annotations

import threading

from jwt import PyJWKClient

from ai_service.core.config import get_settings

_jwks_client: PyJWKClient | None = None
_jwks_lock = threading.Lock()


def get_jwks_client() -> PyJWKClient:
    """Return a process-wide singleton ``PyJWKClient``.

    ``PyJWKClient`` fetches the JWKS document from Supabase on first use and
    caches the keys in memory. The cache lifespan is bounded by
    ``JWKS_CACHE_TTL_SECONDS`` (default 300s) which stays within Supabase's
    10-minute edge cache guidance, so key rotation stays responsive without
    hammering the JWKS endpoint on every request.
    """
    global _jwks_client
    if _jwks_client is None:
        with _jwks_lock:
            if _jwks_client is None:
                settings = get_settings()
                if not settings.SUPABASE_URL:
                    raise RuntimeError("SUPABASE_URL is not configured.")
                _jwks_client = PyJWKClient(
                    uri=settings.jwks_url,
                    cache_keys=True,
                    max_cached_keys=16,
                    cache_jwk_set=True,
                    lifespan=settings.JWKS_CACHE_TTL_SECONDS,
                )
    return _jwks_client


def reset_jwks_client() -> None:
    """Clear the cached client. Primarily for tests / config reloads."""
    global _jwks_client
    with _jwks_lock:
        _jwks_client = None