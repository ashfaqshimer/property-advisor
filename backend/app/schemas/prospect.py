from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProspectBase(BaseModel):
    source: str = "ikman"
    source_id: str | None = None
    source_url: str | None = None
    ikman_ad_id: str | None = None
    ikman_url: str | None = None
    ikman_slug: str | None = None

    @model_validator(mode="before")
    @classmethod
    def sync_source_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            sid = data.get("source_id") or data.get("ikman_ad_id")
            surl = data.get("source_url") or data.get("ikman_url")
            if sid:
                data.setdefault("source_id", sid)
                data.setdefault("ikman_ad_id", sid)
            if surl:
                data.setdefault("source_url", surl)
                data.setdefault("ikman_url", surl)
        elif hasattr(data, "__dict__"):
            sid = getattr(data, "source_id", None) or getattr(data, "ikman_ad_id", None)
            surl = getattr(data, "source_url", None) or getattr(data, "ikman_url", None)
            if sid and not getattr(data, "source_id", None):
                setattr(data, "source_id", sid)
            if surl and not getattr(data, "source_url", None):
                setattr(data, "source_url", surl)
        return data
    title: str
    price: str
    location: str
    suburb: str | None = None
    suburb_source: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    property_type: str
    listing_type: str
    poster_name: str | None = None
    phone_number: str | None = None
    classification: str
    confidence: int
    classification_reasons: list[str] = Field(default_factory=list)
    classification_method: str
    status: str
    is_member: bool = False
    is_auth_dealer: bool = False
    membership_level: str = "free"
    shop_name: str | None = None
    first_scan_job_id: UUID | None = None
    discard_reason: str | None = None


class ProspectCreate(ProspectBase):
    pass


class ProspectUpdate(BaseModel):
    status: str | None = None
    discard_reason: str | None = None


class ProspectRead(ProspectBase):
    id: UUID
    first_seen_at: datetime
    last_seen_at: datetime
    assignment_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ScanRequest(BaseModel):
    source: str = "ikman"
    categories: list[str] = Field(default_factory=lambda: ["property"])
    pages_per_category: int | None = Field(default=None, ge=1)
    scan_all: bool = False
    keyword: str | None = None
    property_category: str = "all"  # all, land, apartments, houses, commercial
    strict_location: bool = True


class ProspectList(BaseModel):
    items: list[ProspectRead]
    total: int
    page: int
    page_size: int
    total_pages: int
    telegram_agent_configured: bool = False


class ScanJobRead(BaseModel):
    id: UUID
    source: str = "ikman"
    job_type: str
    status: str
    progress: str
    error: str | None = None
    keyword: str | None = None
    property_category: str | None = None
    pages_scanned: int = 0
    total_pages: int = 0
    total_found: int = 0
    new_count: int = 0
    updated_count: int = 0
    filtered_count: int = 0
    duration_seconds: float | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanJobList(BaseModel):
    items: list[ScanJobRead]
    total: int
    page: int
    page_size: int
    total_pages: int
