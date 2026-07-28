"""Deterministic mock financial tools for phase one."""

from typing import Any

from langchain_core.tools import tool


@tool
def get_dashboard() -> dict[str, Any]:
    """Get the user's current demo income, expenses, savings goal, and balance."""
    return {
        "income": 50000,
        "expenses": 32000,
        "savings_goal": 10000,
        "available_balance": 18000,
        "currency": "INR",
    }


@tool
def get_transactions() -> list[dict[str, Any]]:
    """Get the user's recent demo transactions."""
    return [
        {"title": "Groceries", "category": "Food", "amount": 2400, "type": "expense"},
        {"title": "Electricity bill", "category": "Bills", "amount": 1800, "type": "expense"},
        {"title": "Salary", "category": "Salary", "amount": 50000, "type": "income"},
    ]


@tool
def get_category_summary() -> dict[str, Any]:
    """Get demo spending totals grouped by expense category."""
    return {
        "currency": "INR",
        "categories": {"Food": 8400, "Bills": 6200, "Travel": 5100, "Shopping": 12300},
    }


FINANCIAL_TOOLS = [get_dashboard, get_transactions, get_category_summary]
