from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Runtime environment.
    # Controls registration of development-only utilities ONLY (e.g. /dev/*
    # routes). Must never branch business logic, auth, DB queries, or AI
    # behavior. Valid values: development | testing | staging | production.
    ENVIRONMENT: str = "development"

    # Groq
    GROQ_API_KEY: str = ""
    MODEL_NAME: str = "openai/gpt-oss-120b"
    TEMPERATURE: float = 0.3

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Conversation
    MAX_CONVERSATION_HISTORY: int = 20  # ponytail: last N messages sent to agent, raise if context feels short

    # Database
    DATABASE_URL: str = ""
    SUPABASE_DATABASE_URL: str = ""

    # Supabase Auth (JWT verification). The Auth module verifies Supabase-issued
    # access tokens via the project's JWKS endpoint (RS256). No shared HS256
    # secret is stored on the backend.
    SUPABASE_URL: str = ""  # e.g. https://<project-ref>.supabase.co
    SUPABASE_ANON_KEY: str = ""  # publishable/anon key (dev helper only; auth module does NOT use it)
    SUPABASE_JWT_ISSUER: str = ""  # default derived from SUPABASE_URL at access time if blank
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ALGORITHMS: str = "ES256,RS256"  # asymmetric algs only; PyJWKClient selects key by kid
    JWKS_CACHE_TTL_SECONDS: int = 300  # keep <= Supabase's 10-min edge cache

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
