from langchain_core.tools import tool


@tool
def get_financial_goals() -> dict:
    """Get the user's active financial goals and their progress."""
    return {
        "goals": [
            {
                "id": "goal_001",
                "name": "Emergency Fund",
                "target_amount": 200000.00,
                "current_amount": 85000.00,
                "currency": "INR",
                "progress_percent": 42.5,
                "deadline": "2027-03-31",
                "status": "on_track",
            },
            {
                "id": "goal_002",
                "name": "New Laptop",
                "target_amount": 80000.00,
                "current_amount": 35000.00,
                "currency": "INR",
                "progress_percent": 43.75,
                "deadline": "2026-12-31",
                "status": "on_track",
            },
            {
                "id": "goal_003",
                "name": "Goa Trip",
                "target_amount": 30000.00,
                "current_amount": 12000.00,
                "currency": "INR",
                "progress_percent": 40.0,
                "deadline": "2026-10-15",
                "status": "behind",
            },
        ],
        "total_goals": 3,
    }
