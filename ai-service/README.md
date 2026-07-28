# BuyWise AI Service

Phase-one implementation of the BuyWise financial AI agent.

The service currently uses one LangChain agent with Gemini 2.5 Flash. Its tools
return deterministic mock financial data so prompt design, tool selection, and
conversation flow can be validated before backend integration.

There is intentionally no Go backend, database, Supabase, authentication, or
frontend integration in this phase.

## Setup

```powershell
uv sync
Copy-Item .env.example .env
uv run uvicorn ai_service.main:app --reload
```

Set `GEMINI_API_KEY` in `.env` before calling `POST /api/v1/chat`.
