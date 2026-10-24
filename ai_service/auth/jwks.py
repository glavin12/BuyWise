from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable

from jwt import PyJWK, PyJWKClient
from jwt.exceptions import PyJWKClientError

from ai_service.core.config import get_settings

logger = logging.getLogger(__name__)

_jwks_client: JWKSKeyStore | None = None
_jwks_lock = threading.Lock()


class JWKSKeyStore:
    """The project's signing keys by ``kid``, refreshed on a schedule and never on demand.

    ``PyJWKClient`` on its own refetches the key set whenever a token names an
    unknown ``kid`` (so forged tokens each cost an outbound request) and, with
    ``cache_keys``, trusts a key until the process restarts (so a revoked key
    keeps working). This store replaces both:

    * Keys are good for ``ttl`` seconds, then refetched, so a revoked key stops
      working within that time.
    * At most one fetch per ``min_refetch_interval`` seconds, whatever the
      reason (expiry, an unknown ``kid``, or a failed earlier try). A key that
      was rotated in is picked up by the next fetch the interval allows.
    * One fetch at a time: threads that arrive while it runs wait for its result.
    * If a fetch fails, the last good keys keep working for up to ``stale_ttl``
      seconds past their expiry, so a network blip does not sign everyone out.
    """

    def __init__(
        self,
        fetch_keys: Callable[[], list[PyJWK]],
        *,
        ttl: float,
        stale_ttl: float,
        min_refetch_interval: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._fetch_keys = fetch_keys
        self._ttl = ttl
        self._stale_ttl = stale_ttl
        self._min_refetch_interval = min_refetch_interval
        self._clock = clock
        self._lock = threading.Lock()
        # (keys by kid, time of the fetch), replaced as one object so a lookup that
        # holds no lock never sees a half-updated set.
        self._snapshot: tuple[dict[str, PyJWK], float] | None = None
        self._last_attempt: float | None = None

    def get_signing_key(self, kid: str) -> PyJWK:
        """Return the key for ``kid``; raises ``PyJWKClientError`` if there is none to trust."""
        key = self._fresh_key(kid)
        if key is not None:
            return key
        with self._lock:
            # Another thread may have refreshed the keys while this one waited.
            key = self._fresh_key(kid)
            if key is not None:
                return key
            self._refresh_if_due()
            key = self._usable_keys().get(kid)
            if key is None:
                raise PyJWKClientError(f'Unable to find a signing key that matches: "{kid}"')
            return key

    def _fresh_key(self, kid: str) -> PyJWK | None:
        snapshot = self._snapshot
        if snapshot is None or self._clock() - snapshot[1] > self._ttl:
            return None
        return snapshot[0].get(kid)

    def _usable_keys(self) -> dict[str, PyJWK]:
        """The last good keys, unless they are older than the TTL plus the stale allowance."""
        snapshot = self._snapshot
        if snapshot is None or self._clock() - snapshot[1] > self._ttl + self._stale_ttl:
            return {}
        return snapshot[0]

    def _refresh_if_due(self) -> None:
        now = self._clock()
        if self._last_attempt is not None and now - self._last_attempt < self._min_refetch_interval:
            return
        self._last_attempt = now
        try:
            keys = self._fetch_keys()
        except Exception as exc:
            # Anything a fetch can throw (network, bad JSON, an empty key set) means the same thing here:
            # keep the last good keys if they are still within their stale allowance.
            snapshot = self._snapshot
            age = f"{now - snapshot[1]:.0f}s old" if snapshot else "none cached"
            logger.warning("JWKS refresh failed (%s: %s); last good keys: %s", type(exc).__name__, exc, age)
            return
        self._snapshot = ({key.key_id: key for key in keys}, now)


def get_jwks_client() -> JWKSKeyStore:
    """Return the process-wide key store, built on first use.

    The keys are fetched from Supabase over plain urllib inside the request's
    threadpool thread, so the fetch has a short timeout (the mobile app gives
    up on a request after 15 s). ``PyJWKClient`` only does the fetch and the
    parsing; caching is the store's job.
    """
    global _jwks_client
    if _jwks_client is None:
        with _jwks_lock:
            if _jwks_client is None:
                settings = get_settings()
                if not settings.SUPABASE_URL:
                    raise RuntimeError("SUPABASE_URL is not configured.")
                client = PyJWKClient(
                    uri=settings.jwks_url,
                    cache_keys=False,
                    cache_jwk_set=False,
                    timeout=settings.JWKS_FETCH_TIMEOUT_SECONDS,
                )
                _jwks_client = JWKSKeyStore(
                    client.get_signing_keys,
                    ttl=settings.JWKS_CACHE_TTL_SECONDS,
                    stale_ttl=settings.JWKS_STALE_IF_ERROR_SECONDS,
                    min_refetch_interval=settings.JWKS_MIN_REFETCH_SECONDS,
                )
    return _jwks_client


def reset_jwks_client() -> None:
    """Clear the cached client. Primarily for tests / config reloads."""
    global _jwks_client
    with _jwks_lock:
        _jwks_client = None
