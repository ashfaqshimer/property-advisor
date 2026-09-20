from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SiteConfigurationBase(BaseModel):
    phone_numbers: list[str] = Field(default_factory=list)
    show_phone_numbers: bool = True
    contact_email: str | None = None
    show_contact_email: bool = True
    instagram_link: str | None = None
    show_instagram_link: bool = True
    facebook_link: str | None = None
    show_facebook_link: bool = True
    x_link: str | None = None
    show_x_link: bool = True
    tiktok_link: str | None = None
    show_tiktok_link: bool = True
    city: str | None = None
    show_city: bool = True
    extra_settings: dict[str, Any] | None = Field(default_factory=dict)


class SiteConfigurationCreate(SiteConfigurationBase):
    pass


class SiteConfigurationUpdate(BaseModel):
    phone_numbers: list[str] | None = None
    show_phone_numbers: bool | None = None
    contact_email: str | None = None
    show_contact_email: bool | None = None
    instagram_link: str | None = None
    show_instagram_link: bool | None = None
    facebook_link: str | None = None
    show_facebook_link: bool | None = None
    x_link: str | None = None
    show_x_link: bool | None = None
    tiktok_link: str | None = None
    show_tiktok_link: bool | None = None
    city: str | None = None
    show_city: bool | None = None
    extra_settings: dict[str, Any] | None = None


class SiteConfigurationResponse(SiteConfigurationBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
