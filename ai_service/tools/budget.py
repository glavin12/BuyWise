from langchain_core.tools import tool


@tool
def get_budget_status() -> dict:
    """Get the user's current monthly budget status including spending by category and remaining budget."""
    return {
        "month": "July 2026",
        "total_budget": 40000.00,
        "total_spent": 22750.00,
        "remaining": 17250.00,
        "currency": "INR",
        "categories": [
            {"name": "Food & Dining", "budget": 8000.00, "spent": 5200.00, "remaining": 2800.00},
            {"name": "Transport", "budget": 4000.00, "spent": 2100.00, "remaining": 1900.00},
            {"name": "Shopping", "budget": 6000.00, "spent": 4500.00, "remaining": 1500.00},
            {"name": "Utilities", "budget": 5000.00, "spent": 3200.00, "remaining": 1800.00},
            {"name": "Entertainment", "budget": 3000.00, "spent": 1750.00, "remaining": 1250.00},
            {"name": "Groceries", "budget": 6000.00, "spent": 3800.00, "remaining": 2200.00},
            {"name": "Investment", "budget": 8000.00, "spent": 5000.00, "remaining": 3000.00},
        ],
        "days_remaining_in_month": 1,
    }
