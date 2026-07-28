"""Construction of the single phase-one LangChain financial agent."""

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from ai_service.prompts.financial_coach import FINANCIAL_COACH_SYSTEM_PROMPT
from ai_service.tools.financial_tools import FINANCIAL_TOOLS
from ai_service.utils.settings import Settings


def build_financial_agent(settings: Settings):
    """Build the agent without making a network call."""
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY must be set before using the financial agent")
    model = ChatGoogleGenerativeAI(
        model=settings.gemini_model, google_api_key=settings.gemini_api_key, temperature=0.2
    )
    return create_agent(
        model=model, tools=FINANCIAL_TOOLS, system_prompt=FINANCIAL_COACH_SYSTEM_PROMPT
    )
