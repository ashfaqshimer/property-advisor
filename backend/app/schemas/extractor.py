from pydantic import BaseModel, Field

from app.models.property import (
    FurnishingStatus,
    ListingType,
    PropertyType,
)


class ExtractedPropertyDraft(BaseModel):
    """Schema returned by the conversion endpoint, matching frontend expectations."""

    title: str
    description: str
    listing_type: ListingType
    price: float | None = None
    is_price_per_perch: bool
    location: str
    property_type: PropertyType
    
    bedrooms: int | None = None
    bathrooms: int | None = None
    land_size_perches: float | None = None
    floor_area_sqft: int | None = None
    parking_spaces: int | None = None
    build_year: int | None = None
    road_access_ft: int | None = None
    furnishing_status: FurnishingStatus | None = None
    amenities: dict | None = None
    
    has_maids_room: bool = False
    has_maids_toilet: bool = False
    is_gated_community: bool = False
    
    # Contact info from Prospect
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_phones: list[str] = Field(default_factory=list)
    contact_type: str | None = None
    
    image_alt: str


class ExtractPropertyTextRequest(BaseModel):
    """Payload for extracting property details from raw pasted text (WhatsApp, email, etc.)."""

    text: str = Field(..., min_length=5, description="Unstructured text describing a property in English, Sinhala, or Singlish.")


class GeminiPropertyExtraction(BaseModel):
    """Schema provided to Gemini for extracting structured property data. 
    Uses list[str] for amenities to avoid Gemini dict/additionalProperties errors.
    """

    title: str = Field(description="A clean, professional title in English for the property listing.")
    description: str = Field(description="A professional, well-formatted description in English, highlighting key features, distances, and secondary structures (e.g. factory/warehouse), removing any ad boilerplate.")
    listing_type: ListingType = Field(description="Whether the property is for sale or rent.")
    price: float | None = Field(None, description="The price of the property as a raw number in LKR if specified, or None if unpriced/negotiable/urgent call for price. If in Laksha, multiply by 100,000; if in Koti, multiply by 10,000,000; if in Millions, multiply by 1,000,000.")
    is_price_per_perch: bool = Field(False, description="True if the price is listed per perch (common for land).")
    location: str = Field(description="The city or neighborhood location of the property in English.")
    property_type: PropertyType = Field(description="The type of property ('house', 'apartment', 'land', 'commercial', 'mixed_use'). Use 'mixed_use' for combined residential/commercial/factory properties.")
    
    bedrooms: int | None = Field(None, description="Number of bedrooms, if applicable.")
    bathrooms: int | None = Field(None, description="Number of bathrooms, if applicable.")
    land_size_perches: float | None = Field(None, description="Land size in perches, if applicable. If given in sqft, convert to perches by dividing by 272.25.")
    floor_area_sqft: int | None = Field(None, description="Main floor area in square feet, if applicable.")
    parking_spaces: int | None = Field(None, description="Number of parking spaces, if applicable.")
    build_year: int | None = Field(None, description="Year the property was built, if known.")
    road_access_ft: int | None = Field(None, description="Width of road access in feet, if known.")
    furnishing_status: FurnishingStatus | None = Field(None, description="Furnishing status of the property.")
    
    has_maids_room: bool = Field(False, description="True if a maid's room, servant's room, or storage room is explicitly mentioned.")
    has_maids_toilet: bool = Field(False, description="True if a maid's toilet or servant's bathroom is explicitly mentioned.")
    is_gated_community: bool = Field(False, description="True if the property is located in a gated community or complex.")
    
    amenities: list[str] | None = Field(None, description="A list of amenities and features (e.g., ['ac', 'pool', 'hot_water', 'garden', 'gym', 'generator', 'security', 'cctv', 'wifi', 'three_phase_electricity', 'well_water', 'boundary_wall', 'clear_deeds']).")
    
    contact_name: str | None = Field(None, description="Name of the contact person or owner/broker if mentioned.")
    contact_phone: str | None = Field(None, description="Primary phone number of the contact person if mentioned.")
    contact_phones: list[str] | None = Field(None, description="All phone numbers mentioned in the text.")
    contact_type: str | None = Field(None, description="'owner' or 'broker' if discernible from context, or None.")

    image_alt: str = Field(description="A short descriptive alt text in English for the main image (e.g., 'A two-story house with a garden').")
