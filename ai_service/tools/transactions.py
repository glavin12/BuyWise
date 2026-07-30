from langchain_core.tools import tool


@tool
def get_recent_transactions() -> dict:
    """Get the user's recent transactions. Returns a list of the most recent financial transactions."""
    return {
        "transactions": [
            {
                "id": "txn_001",
                "description": "Swiggy - Food Delivery",
                "amount": -450.00,
                "category": "Food & Dining",
                "date": "2026-07-30",
                "type": "debit",
            },
            {
                "id": "txn_002",
                "description": "Amazon - Electronics",
                "amount": -2999.00,
                "category": "Shopping",
                "date": "2026-07-29",
                "type": "debit",
            },
            {
                "id": "txn_003",
                "description": "Salary Credit - TCS",
                "amount": 75000.00,
                "category": "Income",
                "date": "2026-07-28",
                "type": "credit",
            },
            {
                "id": "txn_004",
                "description": "Electricity Bill - BESCOM",
                "amount": -1850.00,
                "category": "Utilities",
                "date": "2026-07-27",
                "type": "debit",
            },
            {
                "id": "txn_005",
                "description": "Netflix Subscription",
                "amount": -649.00,
                "category": "Entertainment",
                "date": "2026-07-26",
                "type": "debit",
            },
            {
                "id": "txn_006",
                "description": "Uber Ride",
                "amount": -320.00,
                "category": "Transport",
                "date": "2026-07-25",
                "type": "debit",
            },
            {
                "id": "txn_007",
                "description": "Zerodha - Mutual Fund SIP",
                "amount": -5000.00,
                "category": "Investment",
                "date": "2026-07-25",
                "type": "debit",
            },
            {
                "id": "txn_008",
                "description": "Reliance Fresh - Groceries",
                "amount": -1280.00,
                "category": "Groceries",
                "date": "2026-07-24",
                "type": "debit",
            },
        ],
        "currency": "INR",
        "total_transactions": 8,
    }


@tool
def add_transaction(description: str, amount: float, category: str) -> dict:
    """Add a new financial transaction. Use positive amount for income, negative for expenses."""
    # ponytail: mock — just echoes back. Real version calls Go backend.
    return {
        "status": "success",
        "message": f"Transaction added: {description}",
        "transaction": {
            "id": "txn_new_001",
            "description": description,
            "amount": amount,
            "category": category,
            "date": "2026-07-30",
            "type": "credit" if amount > 0 else "debit",
        },
    }
