"""Service layer for invoking the financial agent."""

from typing import Any

from ai_service.agent.financial_agent import build_financial_agent
from ai_service.models.chat import ChatResponse
from ai_service.utils.settings import Settings


class FinancialAgentService:
    def __init__(self, settings: Settings) -> None:
        self._agent = build_financial_agent(settings)

    async def chat(self, message: str, user_id: str) -> ChatResponse:
        result: dict[str, Any] = await self._agent.ainvoke(
            {"messages": [{"role": "user", "content": f"User ID: {user_id}\n\n{message}"}]}
        )
        content = result["messages"][-1].content
        return ChatResponse(
            response=content
            if isinstance(content, str)
            else " ".join(str(block) for block in content)
        )
