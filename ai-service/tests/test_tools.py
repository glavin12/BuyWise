from ai_service.tools.financial_tools import get_category_summary, get_dashboard, get_transactions


def test_dashboard_is_deterministic() -> None:
    assert get_dashboard.invoke({})["available_balance"] == 18000


def test_transactions_are_deterministic() -> None:
    transactions = get_transactions.invoke({})
    assert len(transactions) == 3
    assert transactions[0]["category"] == "Food"


def test_category_summary_is_deterministic() -> None:
    assert get_category_summary.invoke({})["categories"]["Food"] == 8400
