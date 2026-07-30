"""
LangChain agent service — creates and runs the AI agent with tools.

ponytail: uses langgraph-prebuilt create_react_agent, the modern replacement
for the deprecated langchain.agents.create_tool_calling_agent.
"""

import logging
import uuid

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from ai_service.core.config import get_settings
from ai_service.tools import all_tools
from ai_service.services.conversation_service import conversation_service
from ai_service.schemas.chat import ChatResponse, ToolCallInfo

logger = logging.getLogger(__name__)

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
- Format currency amounts in Indian Rupees (₹) with proper formatting.
- Be helpful and proactive — suggest insights when appropriate.
"""


# ponytail: single agent instance, no per-request rebuild
_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        settings = get_settings()

        llm = ChatGoogleGenerativeAI(
            model=settings.MODEL_NAME,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=settings.TEMPERATURE,
        )

        _agent = create_react_agent(
            model=llm,
            tools=all_tools,
            prompt=SYSTEM_PROMPT,
        )
    return _agent


async def run_agent(message: str, conversation_id: str | None = None) -> ChatResponse:
    """
    Run the AI agent with a user message.

    1. Generate conversation_id if not provided
    2. Save user message to conversation store
    3. Load recent history for context
    4. Run agent
    5. Save assistant response
    6. Return structured response
    """
    # Generate conversation ID if needed
    if not conversation_id:
        conversation_id = str(uuid.uuid4())

    # Save user message
    conversation_service.add_message(conversation_id, "user", message)

    # Load recent conversation history for context
    settings = get_settings()
    recent_messages = conversation_service.get_messages(
        conversation_id, limit=settings.MAX_CONVERSATION_HISTORY
    )

    # Build message list for the agent (exclude current message, it goes last)
    messages = []
    for msg in recent_messages[:-1]:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))

    # Add current user message
    messages.append(HumanMessage(content=message))

    # Run the agent
    agent = _get_agent()
    try:
        result = await agent.ainvoke({"messages": messages})
    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        error_response = "I'm sorry, I encountered an error processing your request. Please try again."
        conversation_service.add_message(conversation_id, "assistant", error_response)
        return ChatResponse(
            response=error_response,
            conversation_id=conversation_id,
            tool_calls=[],
        )

    # Extract the final AI response from the message list
    result_messages = result.get("messages", [])
    ai_response = "I couldn't generate a response."
    tool_calls = []

    for msg in result_messages:
        if isinstance(msg, AIMessage):
            # The last AIMessage with text content is the final response
            if msg.content and isinstance(msg.content, str):
                ai_response = msg.content

            # Extract tool calls if present
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls.append(ToolCallInfo(
                        tool_name=tc["name"],
                        tool_input=tc.get("args", {}),
                        tool_output="",  # output comes from ToolMessage
                    ))

        elif isinstance(msg, ToolMessage):
            # Match tool output to the last tool call
            if tool_calls and not tool_calls[-1].tool_output:
                tool_calls[-1].tool_output = str(msg.content)

    # Save assistant response
    conversation_service.add_message(conversation_id, "assistant", ai_response)

    return ChatResponse(
        response=ai_response,
        conversation_id=conversation_id,
        tool_calls=tool_calls,
    )
