"""Wire shapes for `properties`."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.property import PropertyStatus, PropertyType


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
    price: Decimal
    # Constant, not a column — the table is single-currency. Stating it on the wire
    # documents the contract in /docs instead of burying LKR in a frontend formatter.
    currency: Literal["LKR"] = "LKR"
    location: str
    property_type: PropertyType
    bedrooms: int | None
    bathrooms: int | None
    sqft: int | None
    image_urls: list[str]
    image_alt: str
    status: PropertyStatus
    created_at: datetime

    @field_serializer("price")
    def _price_as_number(self, price: Decimal) -> float:
        """Pydantic v2 serializes Decimal to a JSON *string* ("185000000.00") by
        default. The agreed contract is a raw number. Safe: LKR listings run to ~1e8
        and JSON doubles are exact to 2^53 (~9e15).
        """
        return float(price)
