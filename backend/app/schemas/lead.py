"""Wire shapes for the admin leads view."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.lead import LeadIntent


class FallbackLeadRequest(BaseModel):
    """The minimum contact details needed when chat cannot complete."""

    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: str = Field(min_length=1, max_length=128)
    phone: str = Field(min_length=5, max_length=40)
    name: str | None = Field(default=None, max_length=120)


class FallbackLeadResponse(BaseModel):
    captured: bool = True


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None
    phone: str | None
    budget_min: Decimal | None
    budget_max: Decimal | None
    intent: LeadIntent | None
    preferences: str | None
    conversation_id: UUID
    created_at: datetime
    updated_at: datetime

    @field_serializer("budget_min", "budget_max")
    def _decimal_as_number(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None
