"""Pure date and money helpers for the financial services."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


@dataclass(frozen=True)
class MonthRange:
    """Inclusive ``[start, end)`` window for a calendar month."""

    month: int
    year: int
    start: date
    end: date
    days_in_month: int

    @property
    def month_name(self) -> str:
        return calendar.month_name[self.month]


def _as_date(value: datetime | date | None) -> date:
    if value is None:
        return datetime.now(timezone.utc).date()
    return value.date() if isinstance(value, datetime) else value


def current_month_range(now: datetime | date | None = None) -> MonthRange:
    current = _as_date(now)
    return month_range(current.month, current.year)


def month_range(month: int, year: int) -> MonthRange:
    if month not in range(1, 13):
        raise ValueError("month must be between 1 and 12")
    if year not in range(2020, 2101):
        raise ValueError("year must be between 2020 and 2100")
    days = calendar.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = start + timedelta(days=days)
    return MonthRange(month=month, year=year, start=start, end=end, days_in_month=days)


def resolve_period(period: str, now: datetime | date | None = None) -> MonthRange:
    current = _as_date(now)
    if period == "this_month":
        return month_range(current.month, current.year)
    if period == "last_month":
        if current.month == 1:
            return month_range(12, current.year - 1)
        return month_range(current.month - 1, current.year)
    raise ValueError("period must be 'this_month' or 'last_month'")


def days_elapsed_in_month(now: datetime | date | None = None) -> int:
    return _as_date(now).day


def days_remaining_in_month(now: datetime | date | None = None) -> int:
    current = _as_date(now)
    return calendar.monthrange(current.year, current.month)[1] - current.day


def amount_to_minor(value: int | float | str | Decimal) -> int:
    """Convert a display amount to integer minor units without float drift."""
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("amount must be a valid number") from exc
    if not decimal_value.is_finite() or decimal_value < 0:
        raise ValueError("amount must be a non-negative finite number")
    return int((decimal_value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def minor_to_amount(value: int) -> float:
    return float(Decimal(value) / Decimal(100))


def format_amount(minor_units: int, currency: str = "INR") -> str:
    return f"{currency} {minor_to_amount(minor_units):,.2f}"
