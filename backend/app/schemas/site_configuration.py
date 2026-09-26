from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StringConfigField(BaseModel):
    value: str | None = None
    show: bool = True

from datetime import datetime

class ListConfigField(BaseModel):
    values: list[str] = Field(default_factory=list)
    show: bool = True


class ScannerSettingsConfigField(BaseModel):
    enabled: bool = False
    frequency_hours: int = Field(default=24, description="Must be 6, 12, 18, or 24")
    pages_to_scan: int = Field(default=5, ge=1, le=50)
    property_types: list[str] = Field(default_factory=lambda: ["house", "apartment"])
    last_run_at: datetime | None = None
    last_run_status: str | None = None


class SiteConfigurationBase(BaseModel):
    phone_numbers: ListConfigField = Field(default_factory=ListConfigField)
    contact_email: StringConfigField = Field(default_factory=StringConfigField)
    whatsapp: StringConfigField = Field(default_factory=StringConfigField)
    instagram_link: StringConfigField = Field(default_factory=StringConfigField)
    facebook_link: StringConfigField = Field(default_factory=StringConfigField)
    x_link: StringConfigField = Field(default_factory=StringConfigField)
    tiktok_link: StringConfigField = Field(default_factory=StringConfigField)
    city: StringConfigField = Field(default_factory=StringConfigField)
    scanner_settings: ScannerSettingsConfigField = Field(default_factory=ScannerSettingsConfigField)
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
    scanner_settings: ScannerSettingsConfigField | None = None
    extra_settings: dict[str, Any] | None = None
    prospect_retention_days: int | None = None


class SiteConfigurationResponse(SiteConfigurationBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
