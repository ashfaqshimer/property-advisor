"""Wire shapes for `property_contacts` and `property_contact_phones`."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.property_contact import PropertyContactType


class PropertyContactPhoneCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(min_length=1, max_length=32)
    label: str | None = Field(default=None, max_length=40)
    is_whatsapp: bool = False


class PropertyContactPhoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str
    label: str | None
    is_whatsapp: bool


class PropertyContactCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    contact_type: PropertyContactType
    full_name: str = Field(min_length=1, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=4000)
    phones: list[PropertyContactPhoneCreate] = Field(default_factory=list)


class PropertyContactUpdate(BaseModel):
    """All fields optional — PATCH semantics. `phones`, if supplied, replaces the list wholesale."""

    model_config = ConfigDict(str_strip_whitespace=True)

    contact_type: PropertyContactType | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=4000)
    phones: list[PropertyContactPhoneCreate] | None = None


class PropertyContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contact_type: PropertyContactType
    full_name: str
    company_name: str | None
    email: str | None
    notes: str | None
    created_at: datetime
    phones: list[PropertyContactPhoneRead]
