from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProspectBase(BaseModel):
    source: str = "ikman"
    ikman_ad_id: str
    ikman_url: str
    ikman_slug: str
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
