"""Wire shapes for the admin leads view."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer

from app.models.lead import LeadIntent, LeadInterest, LeadSource


class FallbackLeadRequest(BaseModel):
    """The minimum contact details needed when chat cannot complete."""

    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: str = Field(min_length=1, max_length=128)
    phone: str = Field(min_length=5, max_length=40)
    name: str | None = Field(default=None, max_length=120)


class FallbackLeadResponse(BaseModel):
    captured: bool = True


class ManualLeadCreate(BaseModel):
    """Fields staff can enter when a lead did not arrive through chat."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    intent: LeadIntent | None = None
    requirements: str | None = Field(default=None, max_length=4000)
    interest: LeadInterest | None = None
    remarks: str | None = Field(default=None, max_length=4000)
    conversation_id: UUID | None = None


class LeadUpdate(BaseModel):
    """Lead fields staff may correct; provenance fields are intentionally absent."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, min_length=5, max_length=40)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    intent: LeadIntent | None = None
    requirements: str | None = Field(default=None, max_length=4000)
    interest: LeadInterest | None = None
    remarks: str | None = Field(default=None, max_length=4000)


class LeadEditorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None
    phone: str | None
    budget_min: Decimal | None
    budget_max: Decimal | None
    intent: LeadIntent | None
    requirements: str | None
    interest: LeadInterest | None
    remarks: str | None
    source: LeadSource | None
    edited_by: LeadEditorRead | None
    conversation_id: UUID | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("budget_min", "budget_max")
    def _decimal_as_number(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None
