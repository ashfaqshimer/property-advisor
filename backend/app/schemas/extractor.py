from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.property import (
    FurnishingStatus,
    ListingType,
    PropertyType,
)


class ExtractedPropertyDraft(BaseModel):
    """Schema returned by the conversion endpoint, matching frontend expectations."""

    title: str = ""
    description: str = ""
    listing_type: ListingType = ListingType.SALE
    price: float | None = None
    is_price_per_perch: bool = False
    location: str = ""
    property_type: PropertyType = PropertyType.HOUSE

    bedrooms: int | None = None
    bathrooms: int | None = None
    land_size_perches: float | None = None
    floor_area_sqft: int | None = None
    parking_spaces: int | None = None
    build_year: int | None = None
    road_access_ft: int | None = None
    furnishing_status: FurnishingStatus | None = None
    amenities: dict[str, bool] | None = None

    has_maids_room: bool = False
    has_maids_toilet: bool = False
    is_gated_community: bool = False

    # Contact info from Prospect / freeform text
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_phones: list[str] = Field(default_factory=list)
    contact_type: str | None = None

    image_alt: str = ""

    # Prospect source tracking metadata
    source_platform: str | None = None
    source_url: str | None = None
    source_id: str | None = None
    prospect_id: UUID | None = None

    @field_validator("contact_phones", mode="before")
    @classmethod
    def _validate_contact_phones(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            val = v.strip()
            return [val] if val else []
        if isinstance(v, (list, tuple, set)):
            return [str(item).strip() for item in v if item and str(item).strip()]
        return []

    @field_validator(
        "has_maids_room",
        "has_maids_toilet",
        "is_gated_community",
        "is_price_per_perch",
        mode="before",
    )
    @classmethod
    def _coerce_bool(cls, v: Any) -> bool:
        if v is None:
            return False
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    @field_validator("image_alt", mode="before")
    @classmethod
    def _coerce_image_alt(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("amenities", mode="before")
    @classmethod
    def _coerce_amenities(cls, v: Any) -> dict[str, bool] | None:
        if not v:
            return None
        if isinstance(v, dict):
            return {str(k): bool(val) for k, val in v.items() if val}
        if isinstance(v, (list, tuple, set)):
            return {str(item): True for item in v if item}
        return None


class ExtractPropertyTextRequest(BaseModel):
    """Payload for extracting property details from raw pasted text (WhatsApp, email, etc.)."""

    text: str = Field(
        ...,
        min_length=5,
        description="Unstructured text describing a property in English, Sinhala, or Singlish.",
    )


class GeminiPropertyExtraction(BaseModel):
    """Schema provided to Gemini for extracting structured property data.

    Uses list[str] for amenities to avoid Gemini dict/additionalProperties errors.
    All optional and defaultable fields permit None so that LLM null emissions never fail validation.
    """

    title: str = Field(
        default="",
        description="A clean, professional title in English for the property listing.",
    )
    description: str = Field(
        default="",
        description="A professional, well-formatted description in English, highlighting key features, distances, and secondary structures (e.g. factory/warehouse), removing any ad boilerplate.",
    )
    listing_type: ListingType = Field(
        default=ListingType.SALE,
        description="Whether the property is for sale or rent.",
    )
    price: float | None = Field(
        default=None,
        description="The price of the property as a raw number in LKR if specified, or None if unpriced/negotiable/urgent call for price. If in Laksha, multiply by 100,000; if in Koti, multiply by 10,000,000; if in Millions, multiply by 1,000,000.",
    )
    is_price_per_perch: bool | None = Field(
        default=False,
        description="True if the price is listed per perch (common for land).",
    )
    location: str = Field(
        default="",
        description="The city or neighborhood location of the property in English.",
    )
    property_type: PropertyType = Field(
        default=PropertyType.HOUSE,
        description="The type of property ('house', 'apartment', 'land', 'commercial', 'mixed_use'). Use 'mixed_use' for combined residential/commercial/factory properties.",
    )

    bedrooms: int | None = Field(
        default=None, description="Number of bedrooms, if applicable."
    )
    bathrooms: int | None = Field(
        default=None, description="Number of bathrooms, if applicable."
    )
    land_size_perches: float | None = Field(
        default=None,
        description="Land size in perches, if applicable. If given in sqft, convert to perches by dividing by 272.25. If in acres, multiply by 160.",
    )
    floor_area_sqft: int | None = Field(
        default=None,
        description="Main floor area in square feet, if applicable.",
    )
    parking_spaces: int | None = Field(
        default=None, description="Number of parking spaces, if applicable."
    )
    build_year: int | None = Field(
        default=None, description="Year the property was built, if known."
    )
    road_access_ft: int | None = Field(
        default=None, description="Width of road access in feet, if known."
    )
    furnishing_status: FurnishingStatus | None = Field(
        default=None,
        description="Furnishing status of the property ('unfurnished', 'semi_furnished', 'fully_furnished').",
    )

    has_maids_room: bool | None = Field(
        default=False,
        description="True if a maid's room, servant's room, or storage room is explicitly mentioned.",
    )
    has_maids_toilet: bool | None = Field(
        default=False,
        description="True if a maid's toilet or servant's bathroom is explicitly mentioned.",
    )
    is_gated_community: bool | None = Field(
        default=False,
        description="True if the property is located in a gated community or complex.",
    )

    amenities: list[str] | None = Field(
        default_factory=list,
        description="A list of amenities and features (e.g., ['ac', 'pool', 'hot_water', 'garden', 'gym', 'generator', 'security', 'cctv', 'wifi', 'three_phase_electricity', 'well_water', 'boundary_wall', 'clear_deeds']).",
    )

    contact_name: str | None = Field(
        default=None,
        description="Name of the contact person or owner/broker if mentioned.",
    )
    contact_phone: str | None = Field(
        default=None,
        description="Primary phone number of the contact person if mentioned.",
    )
    contact_phones: list[str] | None = Field(
        default_factory=list,
        description="All phone numbers mentioned in the text.",
    )
    contact_type: str | None = Field(
        default=None,
        description="'owner' or 'broker' if discernible from context, or None.",
    )

    image_alt: str | None = Field(
        default="",
        description="A short descriptive alt text in English for the main image (e.g., 'A two-story house with a garden').",
    )

    @field_validator(
        "has_maids_room",
        "has_maids_toilet",
        "is_gated_community",
        "is_price_per_perch",
        mode="before",
    )
    @classmethod
    def _coerce_bool(cls, v: Any) -> bool:
        if v is None:
            return False
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    @field_validator("amenities", "contact_phones", mode="before")
    @classmethod
    def _coerce_list(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            val = v.strip()
            return [val] if val else []
        if isinstance(v, (list, tuple, set)):
            return [str(item).strip() for item in v if item and str(item).strip()]
        return []

    @field_validator("image_alt", mode="before")
    @classmethod
    def _coerce_image_alt(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()
