"""Access-token verification against locally generated keys and a fake JWKS endpoint.

No test reaches Supabase: keys are made here, the JWKS fetch is a stub, and the
cache tests move a fake clock instead of sleeping.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import logging
import threading
import time
import uuid
from urllib.error import URLError

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWK
from jwt.algorithms import ECAlgorithm, RSAAlgorithm
from jwt.exceptions import PyJWKClientConnectionError

import ai_service.auth.jwks as jwks
import ai_service.auth.security as security
from ai_service.auth import ExpiredTokenError, InvalidTokenError, get_current_user
from ai_service.core.config import Settings

SUPABASE_URL = "https://test.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
AUDIENCE = "authenticated"


class Signer:
    """A signing key pair that can mint tokens and publish its public half as a JWK."""

    def __init__(self, kid: str, alg: str) -> None:
        self.kid = kid
        self.alg = alg
        if alg == "RS256":
            self.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            self.jwk = RSAAlgorithm.to_jwk(self.private_key.public_key(), as_dict=True)
        else:
            self.private_key = ec.generate_private_key(ec.SECP256R1())
            self.jwk = ECAlgorithm.to_jwk(self.private_key.public_key(), as_dict=True)
        self.jwk.update(kid=kid, alg=alg, use="sig")
        self.public_pem = self.private_key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )

    def token(self, claims: dict | None = None, *, drop: tuple[str, ...] = (), headers: dict | None = None) -> str:
        now = int(time.time())
        payload = {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": str(uuid.uuid4()),
            "role": "authenticated",
            "iat": now,
            "exp": now + 3600,
        }
        payload.update(claims or {})
        for name in drop:
            payload.pop(name)
        return jwt.encode(
            payload,
            self.private_key,
            algorithm=self.alg,
            headers={"kid": self.kid} if headers is None else headers,
        )


@pytest.fixture(scope="module")
def rsa_signer() -> Signer:
    return Signer("rsa-1", "RS256")


@pytest.fixture(scope="module")
def rsa_signer_2() -> Signer:
    return Signer("rsa-2", "RS256")


@pytest.fixture(scope="module")
def ec_signer() -> Signer:
    return Signer("ec-1", "ES256")


class FakeJWKS:
    """The JWKS endpoint: whichever signers are published, and a count of fetches."""

    def __init__(self, *signers: Signer) -> None:
        self.signers = list(signers)
        self.fetches = 0
        self.failing = False
        self.timeouts: list[float] = []
        self.urls: list[str] = []

    def document(self) -> dict:
        return {"keys": [signer.jwk for signer in self.signers]}

    def fetch_keys(self) -> list[PyJWK]:
        self.fetches += 1
        if self.failing:
            raise PyJWKClientConnectionError("endpoint is down")
        return [PyJWK(signer.jwk) for signer in self.signers]

    def urlopen(self, request, timeout=None, context=None):
        self.fetches += 1
        self.timeouts.append(timeout)
        self.urls.append(request.full_url)
        if self.failing:
            raise URLError("endpoint is down")
        return io.BytesIO(json.dumps(self.document()).encode())


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def auth_settings(monkeypatch):
    settings = Settings(
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_JWT_ISSUER="",
        SUPABASE_JWT_AUDIENCE=AUDIENCE,
        SUPABASE_JWT_ALGORITHMS="ES256,RS256",
        JWKS_CACHE_TTL_SECONDS=300,
    )
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    monkeypatch.setattr(jwks, "get_settings", lambda: settings)
    jwks.reset_jwks_client()
    yield settings
    jwks.reset_jwks_client()


@pytest.fixture
def endpoint(monkeypatch, rsa_signer, ec_signer) -> FakeJWKS:
    """The real client wiring (get_jwks_client) over a stubbed HTTP fetch."""
    source = FakeJWKS(rsa_signer, ec_signer)
    monkeypatch.setattr("jwt.jwks_client.urllib.request.urlopen", source.urlopen)
    return source


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def cached(monkeypatch, rsa_signer, ec_signer, clock) -> tuple[FakeJWKS, jwks.JWKSKeyStore]:
    """A key store on a fake clock, installed where verify_access_token finds it."""
    source = FakeJWKS(rsa_signer, ec_signer)
    store = jwks.JWKSKeyStore(
        source.fetch_keys, ttl=300, stale_ttl=3600, min_refetch_interval=60, clock=clock
    )
    monkeypatch.setattr(jwks, "_jwks_client", store)
    return source, store


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def hand_made_token(header: dict, payload: dict, signature: bytes = b"") -> str:
    return ".".join([b64(json.dumps(header).encode()), b64(json.dumps(payload).encode()), b64(signature)])


def good_payload() -> dict:
    now = int(time.time())
    return {"iss": ISSUER, "aud": AUDIENCE, "sub": str(uuid.uuid4()), "iat": now, "exp": now + 3600}


# --- accepted and rejected claims -----------------------------------------------------


def test_valid_rs256_token_is_accepted(endpoint, rsa_signer):
    token = rsa_signer.token()

    claims = security.verify_access_token(token)

    assert claims["iss"] == ISSUER
    assert claims["aud"] == AUDIENCE


def test_valid_es256_token_is_accepted(endpoint, ec_signer):
    claims = security.verify_access_token(ec_signer.token())

    assert claims["role"] == "authenticated"


def test_get_current_user_maps_a_verified_token(endpoint, rsa_signer):
    user_id = uuid.uuid4()
    token = rsa_signer.token({"sub": str(user_id), "email": "a@b.test"})

    user = get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    assert user.id == user_id
    assert user.email == "a@b.test"


def test_expired_token_raises_expired_token_error(endpoint, rsa_signer):
    now = int(time.time())
    token = rsa_signer.token({"iat": now - 7200, "exp": now - 3600})

    with pytest.raises(ExpiredTokenError):
        security.verify_access_token(token)


def test_token_that_expired_a_moment_ago_is_accepted_within_leeway(endpoint, rsa_signer):
    now = int(time.time())

    claims = security.verify_access_token(rsa_signer.token({"iat": now - 3600, "exp": now - 10}))

    assert claims["exp"] == now - 10


def test_iat_slightly_in_the_future_is_accepted_within_leeway(endpoint, rsa_signer):
    # The server clock running a little behind the clock that issued the token.
    now = int(time.time())

    claims = security.verify_access_token(rsa_signer.token({"iat": now + 30}))

    assert claims["iat"] == now + 30


def test_iat_beyond_leeway_is_rejected_and_the_log_names_the_clock(endpoint, rsa_signer, caplog):
    now = int(time.time())
    token = rsa_signer.token({"iat": now + 300})

    with caplog.at_level(logging.WARNING, logger=security.logger.name):
        with pytest.raises(InvalidTokenError):
            security.verify_access_token(token)

    assert "not yet valid" in caplog.text
    assert "clock" in caplog.text
    assert token not in caplog.text


def test_wrong_issuer_is_rejected(endpoint, rsa_signer):
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer.token({"iss": "https://evil.example/auth/v1"}))


def test_wrong_audience_is_rejected(endpoint, rsa_signer):
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer.token({"aud": "somebody-else"}))


def test_token_without_sub_is_rejected(endpoint, rsa_signer):
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer.token(drop=("sub",)))


def test_token_signed_by_another_key_is_rejected(endpoint, rsa_signer, rsa_signer_2):
    # Same kid as a published key, but a different private key.
    forged = jwt.encode(
        good_payload(), rsa_signer_2.private_key, algorithm="RS256", headers={"kid": rsa_signer.kid}
    )

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(forged)


def test_malformed_token_is_rejected(endpoint):
    with pytest.raises(InvalidTokenError):
        security.verify_access_token("not-a-jwt")

    assert endpoint.fetches == 0


# --- algorithm and kid checks happen before any key lookup ----------------------------


def test_alg_none_token_is_rejected_without_fetching_keys(endpoint, rsa_signer):
    token = hand_made_token({"alg": "none", "typ": "JWT", "kid": rsa_signer.kid}, good_payload())

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(token)

    assert endpoint.fetches == 0


def test_hs256_token_signed_with_the_public_key_is_rejected_without_fetching_keys(endpoint, rsa_signer):
    # The classic algorithm-confusion forgery: the public key used as an HMAC secret.
    header = {"alg": "HS256", "typ": "JWT", "kid": rsa_signer.kid}
    signing_input = ".".join([b64(json.dumps(header).encode()), b64(json.dumps(good_payload()).encode())])
    signature = hmac.new(rsa_signer.public_pem, signing_input.encode(), hashlib.sha256).digest()
    token = f"{signing_input}.{b64(signature)}"

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(token)

    assert endpoint.fetches == 0


def test_algorithm_outside_the_allow_list_is_rejected_without_fetching_keys(endpoint, rsa_signer):
    token = jwt.encode(
        good_payload(), rsa_signer.private_key, algorithm="RS512", headers={"kid": rsa_signer.kid}
    )

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(token)

    assert endpoint.fetches == 0


@pytest.mark.parametrize("kid_header", [{}, {"kid": ""}, {"kid": 7}, {"kid": ["rsa-1"]}])
def test_token_without_a_usable_kid_is_rejected_without_fetching_keys(endpoint, kid_header):
    # Built by hand: PyJWT itself refuses to encode a non-string kid.
    token = hand_made_token({"alg": "RS256", "typ": "JWT", **kid_header}, good_payload(), b"sig")

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(token)

    assert endpoint.fetches == 0


def test_rs256_header_pointing_at_an_ec_key_is_a_clean_rejection(endpoint, rsa_signer, ec_signer):
    # kid names the ES256 key, alg claims RS256: must be a 401, not an error from the crypto layer.
    forged = jwt.encode(
        good_payload(), rsa_signer.private_key, algorithm="RS256", headers={"kid": ec_signer.kid}
    )

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(forged)


# --- the real client wiring ------------------------------------------------------------


def test_jwks_fetch_uses_a_short_timeout(endpoint, rsa_signer):
    security.verify_access_token(rsa_signer.token())

    assert endpoint.urls == [f"{ISSUER}/.well-known/jwks.json"]
    assert endpoint.timeouts == [5]


def test_steady_state_verification_does_not_touch_the_network(endpoint, rsa_signer, ec_signer):
    for _ in range(20):
        security.verify_access_token(rsa_signer.token())
        security.verify_access_token(ec_signer.token())

    assert endpoint.fetches == 1


def test_forged_tokens_with_random_kids_do_not_each_trigger_a_fetch(endpoint, rsa_signer):
    for _ in range(10):
        forged = rsa_signer.token(headers={"kid": uuid.uuid4().hex})
        with pytest.raises(InvalidTokenError):
            security.verify_access_token(forged)

    assert endpoint.fetches == 1


# --- key cache: refetch throttle, lifespan, stale-if-error ------------------------------


def test_unknown_kid_is_rejected_with_one_refetch_per_throttle_window(cached, rsa_signer, clock):
    source, _ = cached
    security.verify_access_token(rsa_signer.token())
    assert source.fetches == 1

    def forged():
        return rsa_signer.token(headers={"kid": uuid.uuid4().hex})

    clock.advance(5)
    for _ in range(5):
        with pytest.raises(InvalidTokenError):
            security.verify_access_token(forged())
    assert source.fetches == 1

    clock.advance(60)
    for _ in range(5):
        with pytest.raises(InvalidTokenError):
            security.verify_access_token(forged())
    assert source.fetches == 2

    clock.advance(60)
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(forged())
    assert source.fetches == 3


def test_a_rotated_in_key_is_picked_up_by_the_next_allowed_refetch(cached, rsa_signer, rsa_signer_2, clock):
    source, _ = cached
    security.verify_access_token(rsa_signer.token())

    source.signers.append(rsa_signer_2)
    clock.advance(5)
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer_2.token())

    clock.advance(60)
    assert security.verify_access_token(rsa_signer_2.token())["role"] == "authenticated"


def test_concurrent_lookups_at_expiry_fetch_once(monkeypatch, rsa_signer, clock):
    source = FakeJWKS(rsa_signer)
    slow_fetch = source.fetch_keys

    def fetch_keys():
        time.sleep(0.05)
        return slow_fetch()

    store = jwks.JWKSKeyStore(fetch_keys, ttl=300, stale_ttl=3600, min_refetch_interval=60, clock=clock)
    monkeypatch.setattr(jwks, "_jwks_client", store)
    token = rsa_signer.token()
    start = threading.Barrier(8)
    results: list[object] = []

    def worker():
        start.wait()
        try:
            results.append(security.verify_access_token(token))
        except Exception as exc:  # pragma: no cover - a failure shows in the assertion below
            results.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert source.fetches == 1
    assert all(isinstance(result, dict) for result in results)


def test_revoked_key_stops_working_after_the_cache_lifespan(cached, rsa_signer, rsa_signer_2, clock):
    source, _ = cached
    source.signers = [rsa_signer, rsa_signer_2]
    old_token = rsa_signer.token()
    assert security.verify_access_token(old_token)

    source.signers = [rsa_signer_2]
    clock.advance(299)
    assert security.verify_access_token(old_token)

    clock.advance(2)
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(old_token)
    assert security.verify_access_token(rsa_signer_2.token())


def test_refresh_failure_keeps_serving_the_last_good_keys_for_a_bounded_time(cached, rsa_signer, clock, caplog):
    source, _ = cached
    token = rsa_signer.token()
    security.verify_access_token(token)
    source.failing = True

    clock.advance(301)
    with caplog.at_level(logging.WARNING, logger=jwks.logger.name):
        assert security.verify_access_token(token)
    assert source.fetches == 2
    assert "JWKS refresh failed" in caplog.text

    # The failed attempt is not repeated on every request.
    clock.advance(10)
    for _ in range(5):
        assert security.verify_access_token(token)
    assert source.fetches == 2

    clock.advance(60)
    assert security.verify_access_token(token)
    assert source.fetches == 3

    # Once the extra time is used up the old keys are no longer trusted.
    clock.advance(3600)
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(token)


def test_stale_keys_do_not_vouch_for_an_unknown_kid(cached, rsa_signer, clock):
    source, _ = cached
    security.verify_access_token(rsa_signer.token())
    source.failing = True
    clock.advance(301)

    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer.token(headers={"kid": "never-published"}))


def test_recovery_after_an_outage_replaces_the_stale_keys(cached, rsa_signer, rsa_signer_2, clock):
    source, _ = cached
    security.verify_access_token(rsa_signer.token())
    source.failing = True
    clock.advance(301)
    assert security.verify_access_token(rsa_signer.token())

    source.failing = False
    source.signers = [rsa_signer_2]
    clock.advance(61)
    with pytest.raises(InvalidTokenError):
        security.verify_access_token(rsa_signer.token())
    assert security.verify_access_token(rsa_signer_2.token())


def test_cold_start_fetch_failure_rejects_without_hammering_the_endpoint(cached, rsa_signer, clock):
    source, _ = cached
    source.failing = True
    token = rsa_signer.token()

    for _ in range(5):
        with pytest.raises(InvalidTokenError):
            security.verify_access_token(token)
        clock.advance(1)
    assert source.fetches == 1

    source.failing = False
    clock.advance(60)
    assert security.verify_access_token(token)
    assert source.fetches == 2
