from langchain_core.tools import tool


@tool
def get_dashboard() -> dict:
    """Get the user's financial dashboard overview including current balance, total spending, monthly income, and savings."""
    return {
        "current_balance": 47250.00,
        "currency": "INR",
        "total_spending_this_month": 22750.00,
        "monthly_income": 75000.00,
        "savings": 15000.00,
        "last_updated": "2026-07-30",
        "account_type": "Savings Account",
        "bank": "HDFC Bank",
    }
