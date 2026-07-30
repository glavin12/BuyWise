"""
BuyWise Phase 1 Tools — All mock implementations with hardcoded data.

Each tool is a LangChain @tool function returning realistic financial data.
These will be replaced with real API calls to the Go backend in later phases.
"""

from ai_service.tools.dashboard import get_dashboard
from ai_service.tools.transactions import get_recent_transactions, add_transaction
from ai_service.tools.budget import get_budget_status
from ai_service.tools.goals import get_financial_goals
from ai_service.tools.profile import get_user_profile
from ai_service.tools.calculator import calculator

# ponytail: single list the agent binds to, add new tools here
all_tools = [
    get_dashboard,
    get_recent_transactions,
    add_transaction,
    get_budget_status,
    get_financial_goals,
    get_user_profile,
    calculator,
]
