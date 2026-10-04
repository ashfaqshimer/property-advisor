from typing import Any
from pydantic import BaseModel, Field, model_validator


class IkmanCategory(BaseModel):
    name: str | None = None
    slug: str | None = None


class IkmanLocation(BaseModel):
    name: str | None = None
    parent: dict[str, Any] | None = None


class IkmanContactCard(BaseModel):
    name: str | None = None
    phoneNumbers: list[dict[str, str | bool]] = Field(default_factory=list)


class IkmanAd(BaseModel):
    id: str
    title: str | None = None
    slug: str | None = None
    price: str | None = None
    category: IkmanCategory | None = None
    location: str | IkmanLocation | None = None
    adType: str | None = None
    isMember: bool = False
    isAuthDealer: bool = False
    membershipLevel: str = "free"
    shopName: str | None = None
    isVerified: bool = False


class IkmanAdDetail(IkmanAd):
    description: str | None = None
    contactCard: IkmanContactCard | None = None
    money: dict[str, Any] | None = None
    properties: list[dict[str, Any]] | None = None

    @model_validator(mode="before")
    @classmethod
    def extract_price(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "price" not in data and "money" in data and isinstance(data["money"], dict):
                data["price"] = data["money"].get("amount")
        return data


class LpwAd(BaseModel):
    id: str
    title: str
    url: str
    price: str | None = None
    location: str | None = None
    suburb: str | None = None
    property_type: str = "house"  # house, apartment, land, commercial
    listing_type: str = "sale"    # sale, rent
    bedrooms: int | None = None
    floor_area_sqft: float | None = None
    has_agent_logo: bool = False
    description_snippet: str | None = None


class LpwAdDetail(LpwAd):
    poster_name: str | None = None
    phone_number: str | None = None
    agent_type: str | None = None  # "Owner", "Agent", etc.
    bathrooms: int | None = None
    land_extent_perches: float | None = None
    furnishing_status: str | None = None
    full_description: str | None = None
    images: list[str] = Field(default_factory=list)
