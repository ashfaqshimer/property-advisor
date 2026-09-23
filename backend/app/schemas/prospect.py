from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProspectBase(BaseModel):
    ikman_ad_id: str
    ikman_url: str
    ikman_slug: str
    title: str
    price: str
    location: str
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


class ProspectCreate(ProspectBase):
    pass


class ProspectUpdate(BaseModel):
    status: str | None = None


class ProspectRead(ProspectBase):
    id: UUID
    first_seen_at: datetime
    last_seen_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanRequest(BaseModel):
    categories: list[str] = Field(..., min_length=1)
    pages_per_category: int = Field(1, ge=1, le=50)


class ProspectList(BaseModel):
    items: list[ProspectRead]
    total: int
    page: int
    page_size: int
    total_pages: int
