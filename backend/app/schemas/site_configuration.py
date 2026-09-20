from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StringConfigField(BaseModel):
    value: str | None = None
    show: bool = True

class ListConfigField(BaseModel):
    values: list[str] = Field(default_factory=list)
    show: bool = True

class SiteConfigurationBase(BaseModel):
    phone_numbers: ListConfigField = Field(default_factory=ListConfigField)
    contact_email: StringConfigField = Field(default_factory=StringConfigField)
    whatsapp: StringConfigField = Field(default_factory=StringConfigField)
    instagram_link: StringConfigField = Field(default_factory=StringConfigField)
    facebook_link: StringConfigField = Field(default_factory=StringConfigField)
    x_link: StringConfigField = Field(default_factory=StringConfigField)
    tiktok_link: StringConfigField = Field(default_factory=StringConfigField)
    city: StringConfigField = Field(default_factory=StringConfigField)
    extra_settings: dict[str, Any] | None = Field(default_factory=dict)
    prospect_retention_days: int = Field(default=30)


class SiteConfigurationCreate(SiteConfigurationBase):
    pass


class SiteConfigurationUpdate(BaseModel):
    phone_numbers: ListConfigField | None = None
    contact_email: StringConfigField | None = None
    whatsapp: StringConfigField | None = None
    instagram_link: StringConfigField | None = None
    facebook_link: StringConfigField | None = None
    x_link: StringConfigField | None = None
    tiktok_link: StringConfigField | None = None
    city: StringConfigField | None = None
    extra_settings: dict[str, Any] | None = None
    prospect_retention_days: int | None = None


class SiteConfigurationResponse(SiteConfigurationBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
