from fastapi import APIRouter, Request, Response

from ai_service.core.config import get_settings
from ai_service.core.rate_limit import limiter

router = APIRouter()
settings = get_settings()


@router.get("/health")
# The route decorator must remain above SlowAPI's decorator so FastAPI
# registers SlowAPI's wrapped endpoint.
@limiter.limit(settings.HEALTH_RATE_LIMIT)
async def health_check(request: Request, response: Response):
    """Health check endpoint."""
    return {"status": "ok", "service": "buywise-ai"}


@router.get("/health/live")
async def liveness_check():
    """Unrestricted liveness probe for process/orchestrator checks."""
    return {"status": "ok", "service": "buywise-ai"}
