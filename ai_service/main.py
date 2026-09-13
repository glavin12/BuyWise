"""
BuyWise AI Service - FastAPI Application

Phase 1: AI chat with database-backed financial tools and PostgreSQL storage.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from ai_service.auth import AuthError
from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter
from ai_service.db.session import dispose_engine
from ai_service.routers import (
    analytics,
    budgets,
    categories,
    chat,
    conversations,
    financial,
    health,
    payees,
    profile,
    transactions,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("BuyWise AI Service starting up...")
    yield
    await dispose_engine()
    logger.info("BuyWise AI Service shutting down...")


app = FastAPI(
    title="BuyWise AI Service",
    description="AI-first personal finance assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: frontend uses Authorization: Bearer, not cookies, so credentials are
# not needed. Wildcard origin + credentials violates the W3C Fetch spec and is
# rejected by browsers, so leave credentials off — this stays valid in prod.
# ponytail: wildcard origin, replace with explicit list if we ever add cookie auth.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

app.state.limiter = limiter

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError) -> JSONResponse:
    """Map every auth failure to a 401 with a Bearer challenge."""
    return JSONResponse(
        status_code=401,
        content={"detail": exc.detail},
        headers={"WWW-Authenticate": "Bearer"},
    )


# Register routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(profile.router)
app.include_router(financial.router)
app.include_router(categories.router)
app.include_router(payees.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(analytics.router)

# Development-only utilities. Never registered outside the ``development``
# environment, so these routes return 404 (not 401) in staging/production.
# The ENVIRONMENT flag controls ONLY this registration; it never branches
# business logic, auth, DB queries, or AI behavior.
settings = get_settings()
if settings.is_development:
    from ai_service.routers import dev

    app.include_router(dev.router)
    logger.info("Development utilities enabled (ENVIRONMENT=development).")


if __name__ == "__main__":
    import uvicorn
    from ai_service.core.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "ai_service.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
