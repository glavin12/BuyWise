"""
LangChain agent service.

The agent receives LangChain message objects only. Persistence stays in the
repository/service layers.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from ai_service.core.config import get_settings
from ai_service.schemas.chat import ToolCallInfo
from ai_service.tools import all_tools

SYSTEM_PROMPT = """You are BuyWise AI, a smart and friendly personal finance assistant.

Your responsibilities:
- Help users understand their financial situation
- Provide accurate information by using your available tools
- Give clear, actionable financial advice based on real data
- Be conversational but precise with numbers

Rules:
- ALWAYS use tools to get financial data. Never make up numbers.
- When asked about balance, spending, or overview, use get_dashboard.
- When asked about transactions, use get_recent_transactions.
- When asked about budget, use get_budget_status.
- When asked about goals or savings goals, use get_financial_goals.
- When asked about profile, salary, or preferences, use get_user_profile.
- When calculations are needed, use the calculator tool.
- Format currency amounts in Indian Rupees (INR) with proper formatting.
- Be helpful and proactive; suggest insights when appropriate.
"""

_agent = None


@dataclass
class ToolExchange:
    """One assistant tool-call turn plus its tool result messages, in order."""

    ai_message: AIMessage
    tool_messages: list[ToolMessage] = field(default_factory=list)


def _get_agent():
    global _agent
    if _agent is None:
        settings = get_settings()
        llm = ChatGroq(
            model=settings.MODEL_NAME,
            api_key=settings.GROQ_API_KEY,
            temperature=settings.TEMPERATURE,
        )
        _agent = create_react_agent(
            model=llm,
            tools=all_tools,
            prompt=SYSTEM_PROMPT,
        )
    return _agent


async def invoke_agent(messages: Sequence[BaseMessage]) -> dict[str, Any]:
    agent = _get_agent()
    return await agent.ainvoke({"messages": list(messages)})


def extract_agent_output(
    result: dict[str, Any],
    input_count: int,
) -> tuple[AIMessage, list[ToolExchange], list[ToolCallInfo]]:
    """Parse this turn's production out of the agent result.

    ``result["messages"]`` is the full state (history + this turn's messages).
    ``input_count`` is how many messages we passed in, so everything after that
    index is what the agent produced this invocation.
    """
    result_messages = result.get("messages", [])
    if len(result_messages) > input_count:
        new_messages = result_messages[input_count:]
    else:
        new_messages = result_messages

    exchanges: list[ToolExchange] = []
    final_ai: AIMessage | None = None
    current_ai: AIMessage | None = None
    current_tools: list[ToolMessage] = []

    for msg in new_messages:
        if isinstance(msg, ToolMessage):
            current_tools.append(msg)
        elif isinstance(msg, AIMessage):
            if msg.tool_calls:
                if current_ai is not None:
                    exchanges.append(
                        ToolExchange(ai_message=current_ai, tool_messages=current_tools)
                    )
                current_ai = msg
                current_tools = []
            else:
                final_ai = msg

    if current_ai is not None:
        exchanges.append(ToolExchange(ai_message=current_ai, tool_messages=current_tools))

    if final_ai is None:
        final_ai = AIMessage(content="I couldn't generate a response.")

    tool_calls: list[ToolCallInfo] = []
    for exchange in exchanges:
        outputs = {tm.tool_call_id: tm.content for tm in exchange.tool_messages}
        for tool_call in exchange.ai_message.tool_calls:
            tool_calls.append(
                ToolCallInfo(
                    tool_name=tool_call.get("name", ""),
                    tool_input=tool_call.get("args", {}),
                    tool_output=str(outputs.get(tool_call.get("id"), "")),
                )
            )

    return final_ai, exchanges, tool_calls
