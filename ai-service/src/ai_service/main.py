"""FastAPI application entry point."""

from fastapi import FastAPI

from ai_service.api.routes import router

app = FastAPI(
    title="BuyWise AI Service",
    version="0.1.0",
    description="Phase-one LangChain financial assistant using Gemini 2.5 Flash.",
)
app.include_router(router)


@app.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
