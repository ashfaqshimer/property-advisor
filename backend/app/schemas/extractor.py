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
    price: float
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
    
    # Contact info from Prospect
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_type: str | None = None
    
    image_alt: str


class GeminiPropertyExtraction(BaseModel):
    """Schema provided to Gemini for extracting structured property data. 
    Uses list[str] for amenities to avoid Gemini dict/additionalProperties errors.
    """

    title: str = Field(description="A clean, professional title for the property listing.")
    description: str = Field(description="A professional, well-formatted description of the property, removing any ad boilerplate.")
    listing_type: ListingType = Field(description="Whether the property is for sale or rent.")
    price: float = Field(description="The price of the property as a raw number (e.g., 150000).")
    is_price_per_perch: bool = Field(description="True if the price is listed per perch (common for land).")
    location: str = Field(description="The city or neighborhood location of the property.")
    property_type: PropertyType = Field(description="The type of property.")
    
    bedrooms: int | None = Field(None, description="Number of bedrooms, if applicable.")
    bathrooms: int | None = Field(None, description="Number of bathrooms, if applicable.")
    land_size_perches: float | None = Field(None, description="Land size in perches, if applicable.")
    floor_area_sqft: int | None = Field(None, description="Floor area in square feet, if applicable.")
    parking_spaces: int | None = Field(None, description="Number of parking spaces, if applicable.")
    build_year: int | None = Field(None, description="Year the property was built, if known.")
    road_access_ft: int | None = Field(None, description="Width of road access in feet, if known.")
    furnishing_status: FurnishingStatus | None = Field(None, description="Furnishing status of the property.")
    amenities: list[str] | None = Field(None, description="A list of amenities (e.g., ['ac', 'pool', 'hot_water']).")
    
    image_alt: str = Field(description="A short descriptive alt text for the main image (e.g., 'A two-story house with a garden').")
