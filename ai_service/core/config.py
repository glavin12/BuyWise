from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Runtime environment.
    # Controls registration of development-only utilities ONLY (e.g. /dev/*
    # routes and the interactive API docs). Must never branch business logic,
    # auth, DB queries, or AI behavior. Valid values: development | testing |
    # staging | production. Defaults to production so a deploy that forgets the
    # variable fails closed; set ENVIRONMENT=development locally (.env.example).
    ENVIRONMENT: str = "production"

    # Amazon Bedrock
    BEDROCK_API_KEY: str = ""
    BEDROCK_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "minimax.minimax-m2.5"
    TEMPERATURE: float = 0.3

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    # JSON array in the environment; bearer auth does not need CORS credentials.
    CORS_ALLOW_ORIGINS: list[str] = ["*"]
    # Per process. Reject excess chats immediately, leaving capacity for CRUD.
    CHAT_MAX_CONCURRENT: int = Field(default=4, ge=1, le=100)

    # Conversation
    MAX_CONVERSATION_HISTORY: int = 30  # last N dialogue messages sent to the agent

    # Database
    DATABASE_URL: str = ""
    SUPABASE_DATABASE_URL: str = ""
    # Ping each pooled connection before use (one SELECT 1, at most 3 s: db/session.py), so one the pooler
    # dropped, or one left half-dead by a network change, is replaced instead of failing the request. It
    # costs one round trip per checkout; keep it on, and turn it off only for local work against a distant
    # database if that round trip matters.
    DB_POOL_PRE_PING: bool = True
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=100)
    DB_MAX_OVERFLOW: int = Field(default=5, ge=0, le=100)
    # Verify both certificate chain and hostname on remote PostgreSQL connections.
    DB_SSL_VERIFY: bool = False

    # Supabase Auth (JWT verification). The Auth module verifies Supabase-issued
    # access tokens via the project's JWKS endpoint (RS256). No shared HS256
    # secret is stored on the backend.
    SUPABASE_URL: str = ""  # e.g. https://<project-ref>.supabase.co
    SUPABASE_ANON_KEY: str = ""  # publishable/anon key (dev helper only; auth module does NOT use it)
    SUPABASE_JWT_ISSUER: str = ""  # default derived from SUPABASE_URL at access time if blank
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ALGORITHMS: str = "ES256,RS256"  # asymmetric algs only; PyJWKClient selects key by kid
    JWKS_CACHE_TTL_SECONDS: int = 300  # keep <= Supabase's 10-min edge cache; a revoked key stops working within this time
    # If refreshing the keys fails (Supabase unreachable), keep trusting the last good ones this much longer
    # than the TTL, so a network blip does not sign everyone out. Past that, tokens are rejected.
    JWKS_STALE_IF_ERROR_SECONDS: int = 3600
    # The keys are fetched at most once per this many seconds, whether the reason is a token with an unknown
    # key id (forged or just rotated in) or a failed earlier try. Stops forged tokens from causing fetches.
    JWKS_MIN_REFETCH_SECONDS: int = 60
    # The fetch runs in a request thread; the mobile app gives up on a request after 15 s.
    JWKS_FETCH_TIMEOUT_SECONDS: float = 5
    # How far the server clock may differ from the clock that issued a token (iat, nbf, exp), in seconds.
    # Without it a clock a second or two behind rejects every fresh token as "not yet valid".
    JWT_LEEWAY_SECONDS: int = 60
    # SECRET. Only for DELETE /api/v1/profile, which deletes the user's Supabase Auth login through the Admin
    # API. The legacy service_role key or a new sb_secret_... key. Set it on the backend host only: never in
    # mobile/ or frontend/, never committed, never logged. Blank => account deletion answers 503 and deletes nothing.
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Rate Limiting (in-memory, per-user via JWT hash / per-IP fallback)
    # Set RATE_LIMIT_ENABLED=false to disable all rate limiting (e.g. testing).
    # Rate strings follow slowapi syntax: "N/period" (period = second|minute|hour|day).
    RATE_LIMIT_ENABLED: bool = True
    CHAT_RATE_LIMIT: str = "20/minute"
    CONVERSATIONS_RATE_LIMIT: str = "60/minute"
    PROFILE_RATE_LIMIT: str = "30/minute"
    FINANCIAL_RATE_LIMIT: str = "60/minute"
    HEALTH_RATE_LIMIT: str = "60/minute"
    DEV_RATE_LIMIT: str = "10/minute"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def jwt_issuer(self) -> str:
        """Resolved JWT issuer, defaulting to ``SUPABASE_URL + /auth/v1``."""
        if self.SUPABASE_JWT_ISSUER:
            return self.SUPABASE_JWT_ISSUER.rstrip("/")
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"
        return ""

    @property
    def jwks_url(self) -> str:
        """JWKS endpoint URL derived from SUPABASE_URL."""
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def is_development(self) -> bool:
        """True when running in the ``development`` environment."""
        return self.ENVIRONMENT == "development"

    @property
    def jwt_algorithms_list(self) -> list[str]:
        """Algorithms as a list for PyJWT."""
        return [alg.strip() for alg in self.SUPABASE_JWT_ALGORITHMS.split(",") if alg.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
