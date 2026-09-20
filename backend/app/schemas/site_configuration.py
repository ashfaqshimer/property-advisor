from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SiteConfigurationBase(BaseModel):
    phone_numbers: list[str] = Field(default_factory=list)
    contact_email: str | None = None
    instagram_link: str | None = None
    facebook_link: str | None = None
    x_link: str | None = None
    tiktok_link: str | None = None
    city: str | None = None
    extra_settings: dict[str, Any] | None = Field(default_factory=dict)


class SiteConfigurationCreate(SiteConfigurationBase):
    pass


class SiteConfigurationUpdate(BaseModel):
    phone_numbers: list[str] | None = None
    contact_email: str | None = None
    instagram_link: str | None = None
    facebook_link: str | None = None
    x_link: str | None = None
    tiktok_link: str | None = None
    city: str | None = None
    extra_settings: dict[str, Any] | None = None


class SiteConfigurationResponse(SiteConfigurationBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
