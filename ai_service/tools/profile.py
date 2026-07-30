from langchain_core.tools import tool


@tool
def get_user_profile() -> dict:
    """Get the user's profile information including salary, preferred currency, and financial preferences."""
    return {
        "name": "Rahul Sharma",
        "email": "rahul.sharma@example.com",
        "salary": 75000.00,
        "currency": "INR",
        "salary_date": 28,  # day of month
        "preferred_bank": "HDFC Bank",
        "account_type": "Savings",
        "financial_preferences": {
            "savings_target_percent": 20,
            "investment_style": "moderate",
            "budget_alerts": True,
        },
    }
