from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProfileRead(BaseModel):
    """User profile as returned to the UI."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    currency: str = "INR"
    income_type: str | None = None
    salary_day: int | None = None
    timezone: str = "Asia/Kolkata"
    onboarding_complete: bool = False
    savings_target_percent: int | None = None
    investment_style: str | None = None
    budget_alerts: bool = True
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    """Fields accepted from the onboarding/settings form. All optional."""

    full_name: str | None = Field(None, max_length=255)
    currency: str | None = Field(None, max_length=10)
    income_type: Literal[
        "salaried", "freelancer", "business_owner", "retired", "other"
    ] | None = None
    salary_day: int | None = Field(None, ge=1, le=31)
    timezone: str | None = None
    onboarding_complete: bool | None = None
    savings_target_percent: int | None = Field(None, ge=0, le=100)
    investment_style: Literal["conservative", "moderate", "aggressive"] | None = None
    budget_alerts: bool | None = None
