"""Pure financial/time helpers shared by the financial services.

No DB access here — these are pure functions for computing month boundaries,
periods, and money formatting that services and tools reuse.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

MONTHS = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
}


@dataclass(frozen=True)
class MonthRange:
    """Inclusive ``[start, end)`` window for a calendar month."""

    month: int
    year: int
    start: datetime
    end: datetime
    days_in_month: int

    @property
    def month_name(self) -> str:
        return MONTHS[self.month]


def current_month_range(now: datetime | None = None) -> MonthRange:
    """Boundaries for the current calendar month (UTC)."""
    now = now or datetime.now(timezone.utc)
    year = now.year
    month = now.month
    return month_range(month, year)


def month_range(month: int, year: int) -> MonthRange:
    """``[start, end)`` datetime window for ``(month, year)`` in UTC."""
    days = calendar.monthrange(year, month)[1]
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, days, 23, 59, 59, 999999, tzinfo=timezone.utc) + timedelta(
        microseconds=1
    )
    return MonthRange(month=month, year=year, start=start, end=end, days_in_month=days)


def resolve_period(period: str, now: datetime | None = None) -> MonthRange:
    """Map a tool ``period`` string to a :class:`MonthRange`.

    Supports ``this_month`` (default) and ``last_month``.
    """
    now = now or datetime.now(timezone.utc)
    if period == "last_month":
        if now.month == 1:
            return month_range(12, now.year - 1)
        return month_range(now.month - 1, now.year)
    return current_month_range(now)


def days_elapsed_in_month(now: datetime | None = None) -> int:
    """1-based count of days elapsed this month."""
    now = now or datetime.now(timezone.utc)
    return now.day


def days_remaining_in_month(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    _, total = calendar.monthrange(now.year, now.month)
    return total - now.day


def fmt_money(value: float) -> str:
    """Format a number as a currency string without symbol (e.g. ``1,234.50``)."""
    return f"{value:,.2f}"
