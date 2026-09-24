"""Wire shapes for `properties`."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.property import (
    FurnishingStatus,
    ListingType,
    PropertyStatus,
    PropertyType,
)
from app.schemas.property_contact import PropertyContactRead


class PropertyRead(BaseModel):
    """One listing, as returned by the API.

    snake_case, matching the columns. The frontend needs a mapping layer regardless
    (`bedrooms` -> `beds`, `image_urls[0]` -> `imageUrl`, price -> "LKR 185M"), so
    camelCase aliases here would close only part of that gap while giving every field
    two names.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    listing_type: ListingType
    price: Decimal
    is_price_per_perch: bool
    is_featured: bool
    # Constant, not a column — the table is single-currency. Stating it on the wire
    # documents the contract in /docs instead of burying LKR in a frontend formatter.
    currency: Literal["LKR"] = "LKR"
    location: str
    property_type: PropertyType
    bedrooms: int | None
    bathrooms: int | None
    land_size_perches: Decimal | None
    floor_area_sqft: int | None
    parking_spaces: int | None
    build_year: int | None
    road_access_ft: int | None
    furnishing_status: FurnishingStatus | None
    amenities: dict | None
    image_urls: list[str]
    image_alt: str
    status: PropertyStatus
    created_at: datetime
    property_contact_id: UUID | None
    property_contact: PropertyContactRead | None

    source_platform: str | None = None
    source_url: str | None = None
    source_id: str | None = None
    prospect_id: UUID | None = None

    has_maids_room: bool
    has_maids_toilet: bool
    is_gated_community: bool

    @field_serializer("price", "land_size_perches")
    def _decimal_as_number(self, value: Decimal | None) -> float | None:
        """Pydantic v2 serializes Decimal to a JSON *string* ("185000000.00") by
        default. The agreed contract is a raw number. Safe: LKR listings run to ~1e8
        and JSON doubles are exact to 2^53 (~9e15).
        """
        return float(value) if value is not None else None


class PropertyCreate(BaseModel):
    title: str
    description: str = ""
    listing_type: ListingType
    price: Decimal
    is_price_per_perch: bool = False
    is_featured: bool = False
    location: str
    property_type: PropertyType
    bedrooms: int | None = None
    bathrooms: int | None = None
    land_size_perches: Decimal | None = None
    floor_area_sqft: int | None = None
    parking_spaces: int | None = None
    build_year: int | None = None
    road_access_ft: int | None = None
    furnishing_status: FurnishingStatus | None = None
    amenities: dict | None = None
    image_urls: list[str] = Field(default_factory=list)
    image_alt: str = ""
    status: PropertyStatus = PropertyStatus.AVAILABLE
    property_contact_id: UUID | None = None

    source_platform: str | None = None
    source_url: str | None = None
    source_id: str | None = None
    prospect_id: UUID | None = None

    has_maids_room: bool = False
    has_maids_toilet: bool = False
    is_gated_community: bool = False


class PropertyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    listing_type: ListingType | None = None
    price: Decimal | None = None
    is_price_per_perch: bool | None = None
    is_featured: bool | None = None
    location: str | None = None
    property_type: PropertyType | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    land_size_perches: Decimal | None = None
    floor_area_sqft: int | None = None
    parking_spaces: int | None = None
    build_year: int | None = None
    road_access_ft: int | None = None
    furnishing_status: FurnishingStatus | None = None
    amenities: dict | None = None
    image_urls: list[str] | None = None
    image_alt: str | None = None
    status: PropertyStatus | None = None
    property_contact_id: UUID | None = None

    source_platform: str | None = None
    source_url: str | None = None
    source_id: str | None = None
    prospect_id: UUID | None = None

    has_maids_room: bool | None = None
    has_maids_toilet: bool | None = None
    is_gated_community: bool | None = None
