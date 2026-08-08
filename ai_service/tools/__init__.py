"""BuyWise AI tools — all database-backed, service-driven.

Each tool is a LangChain @tool (async) that:
  1. Reads the authenticated user + DB session from request context.
  2. Instantiates the relevant service.
  3. Returns structured JSON only — never advice or recommendations.

The agent's SYSTEM_PROMPT (services/agent_service.py) teaches the model which
tool to call for which user question.
"""

from ai_service.tools.calculator import calculator
from ai_service.tools.categories import get_categories
from ai_service.tools.dashboard import get_dashboard
from ai_service.tools.goals import add_goal, get_financial_goals, update_goal_progress
from ai_service.tools.plans import get_budget_status, set_monthly_plan
from ai_service.tools.profile import get_profile
from ai_service.tools.spending import get_income_summary, get_spending_breakdown
from ai_service.tools.transactions import add_transaction, get_recent_transactions

all_tools = [
    get_dashboard,
    get_profile,
    get_recent_transactions,
    add_transaction,
    get_spending_breakdown,
    get_income_summary,
    get_budget_status,
    set_monthly_plan,
    get_financial_goals,
    add_goal,
    update_goal_progress,
    get_categories,
    calculator,
]
