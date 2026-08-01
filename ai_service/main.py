"""
BuyWise AI Service - FastAPI Application

Phase 1: AI chat with mock tools and PostgreSQL conversation storage.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_service.db.session import dispose_engine
from ai_service.routers import chat, conversations, health

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

# CORS: allow all origins in dev, tighten in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(conversations.router)


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
