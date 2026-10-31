"""
BuyWise AI Service - FastAPI Application

Phase 1: AI chat with database-backed financial tools and PostgreSQL storage.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError, TimeoutError as PoolTimeoutError

from ai_service.auth import AuthError
from ai_service.core.config import get_settings
from ai_service.core.observability import RequestLogMiddleware
from ai_service.core.rate_limit import limiter
from ai_service.db.session import DatabaseUnavailableError, dispose_engine
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


settings = get_settings()

# The API docs and schema are a map of the attack surface: development only.
_docs = settings.is_development
app = FastAPI(
    title="BuyWise AI Service",
    description="AI-first personal finance assistant",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

# CORS: bearer authentication needs no cookies. Deployments can restrict the
# web origin through CORS_ALLOW_ORIGINS without changing mobile access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
)
# Bodies of 1 KB or more go out gzipped to clients that ask for it (React Native's fetch does): our JSON
# shrinks by about 80%, which matters for a 500-message chat history. Smaller bodies gain nothing.
app.add_middleware(GZipMiddleware, minimum_size=1000)
# Added last, so outermost: its time and status are what the client got, CORS and gzip included.
app.add_middleware(RequestLogMiddleware)

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


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """A DB constraint conflict (duplicate name, racing insert) is the client's
    conflict, not a server fault. The session dependency has already rolled back
    (its ``async with`` closes the session as the exception propagates); the
    driver message is never echoed because it carries SQL and row values.
    """
    logger.warning("Integrity conflict on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=409,
        content={"detail": "This conflicts with an existing record."},
    )


@app.exception_handler(DatabaseUnavailableError)
@app.exception_handler(PoolTimeoutError)  # no free pooled connection within the pool's wait
@app.exception_handler(OSError)  # a database timeout (TimeoutError), refused connection, or lookup that failed
async def database_unavailable_handler(request: Request, exc: Exception) -> JSONResponse:
    """The database did not answer in time or the connection dropped: say so with a 503, not a bare 500. The
    pool has already discarded the dead connections, so a retry normally succeeds. The driver message is never
    echoed: it carries hosts and SQL.
    """
    logger.warning("Database unavailable on %s %s: %s", request.method, request.url.path, type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={"detail": "The service is temporarily unavailable. Please try again."},
        headers={"Retry-After": "2"},
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
