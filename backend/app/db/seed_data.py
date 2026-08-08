"""The eight listings the homepage grid renders today.

Ported 1:1 from `frontend/lib/properties.ts` — same titles, locations, copy, photos
and alt text — so the eventual swap from fixture to API is visually a no-op. The
fixture's display string `"LKR 185M"` becomes `Decimal("185000000")`; formatting is
the frontend's job.

These are illustrative listings drawn from `context/ui-interface.png`. None of them
exist.
"""

import uuid
from decimal import Decimal
from typing import Any

from app.models.property import PropertyType

# Fixed namespace so ids are reproducible across machines and re-runs. That, plus
# Session.merge, is what makes the seed idempotent without a unique constraint.
SEED_NAMESPACE = uuid.UUID("2f1b9f4a-0d5e-4c3a-9c21-7f3f0a5d8b10")


def _photo(photo_id: str) -> str:
    """Same transform as the frontend fixture: caps what the optimizer downloads."""
    return f"https://images.unsplash.com/photo-{photo_id}?w=1600&q=75&auto=format&fit=crop"


def seed_id(slug: str) -> uuid.UUID:
    """Stable id for a seeded listing."""
    return uuid.uuid5(SEED_NAMESPACE, slug)


# property_type is the one field with no counterpart in the fixture. It's inferred from
# the listing and its photo: the two apartment buildings are APARTMENT, the rest HOUSE.
SEED_PROPERTIES: list[dict[str, Any]] = [
    {
        "slug": "garden-villa-ward-place",
        "title": "Garden Villa on Ward Place",
        "location": "Colombo 7",
        "price": Decimal("185000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 5,
        "bathrooms": 4,
        "sqft": 4200,
        "description": (
            "A serene modern villa with mature gardens in the heart of Cinnamon Gardens."
        ),
        "image_urls": [_photo("1613490493576-7fde63acd811")],
        "image_alt": (
            "Two-storey white villa with a timber-lined upper deck beside a long lap pool"
        ),
    },
    {
        "slug": "havelock-residences",
        "title": "Havelock Residences",
        "location": "Colombo 5",
        "price": Decimal("48000000"),
        "property_type": PropertyType.APARTMENT,
        "bedrooms": 3,
        "bathrooms": 2,
        "sqft": 1650,
        "description": (
            "Light-filled apartment moments from Havelock Town cafés and schools."
        ),
        "image_urls": [_photo("1545324418-cc1a3fa10c00")],
        "image_alt": (
            "Upper floors and balconies of a contemporary apartment building at dusk"
        ),
    },
    {
        "slug": "courtyard-townhouse",
        "title": "Courtyard Townhouse",
        "location": "Rajagiriya",
        "price": Decimal("72000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 4,
        "bathrooms": 3,
        "sqft": 2400,
        "description": (
            "A quiet, low-maintenance townhouse with a private inner courtyard."
        ),
        "image_urls": [_photo("1600585154340-be6161a56a0c")],
        "image_alt": (
            "Dark timber-clad townhouse set back behind a mature tree and clipped lawn"
        ),
    },
    {
        "slug": "skyline-penthouse",
        "title": "Skyline Penthouse",
        "location": "Colombo 3",
        "price": Decimal("240000000"),
        "property_type": PropertyType.APARTMENT,
        "bedrooms": 3,
        "bathrooms": 3,
        "sqft": 3100,
        "description": (
            "Panoramic city and ocean views from a full-floor Kollupitiya penthouse."
        ),
        "image_urls": [_photo("1600607687939-ce8a6c25118c")],
        "image_alt": (
            "Open-plan living room with a timber feature wall and full-height glazing "
            "onto a terrace"
        ),
    },
    {
        "slug": "restored-colonial-retreat",
        "title": "Restored Colonial Retreat",
        "location": "Galle",
        "price": Decimal("130000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 4,
        "bathrooms": 3,
        "sqft": 2800,
        "description": (
            "A lovingly restored coastal home within the historic Fort quarter."
        ),
        "image_urls": [_photo("1570129477492-45c003edd2be")],
        "image_alt": (
            "Grey clapboard colonial house with a white wraparound veranda and front lawn"
        ),
    },
    {
        "slug": "hillside-bungalow",
        "title": "Hillside Bungalow",
        "location": "Kandy",
        "price": Decimal("95000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 4,
        "bathrooms": 3,
        "sqft": 2600,
        "description": "Wrapped in misty hills, a calm escape with wide valley views.",
        "image_urls": [_photo("1568605114967-8130f3a36994")],
        "image_alt": (
            "Gabled timber house lit from within at dusk, framed by a wooded hillside"
        ),
    },
    {
        "slug": "poolside-garden-house",
        "title": "Poolside Garden House",
        "location": "Colombo 7",
        "price": Decimal("160000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 4,
        "bathrooms": 4,
        "sqft": 3600,
        "description": (
            "Single-storey living that opens fully onto a lawn and lap pool."
        ),
        "image_urls": [_photo("1512917774080-9991f1c4c750")],
        "image_alt": (
            "Single-storey white villa with sliding glass doors opening onto a pool terrace"
        ),
    },
    {
        "slug": "beachside-terrace-house",
        "title": "Beachside Terrace House",
        "location": "Mount Lavinia",
        "price": Decimal("88000000"),
        "property_type": PropertyType.HOUSE,
        "bedrooms": 3,
        "bathrooms": 3,
        "sqft": 2100,
        "description": "A breezy home with a rooftop terrace, steps from the shoreline.",
        "image_urls": [_photo("1564013799919-ab600027ffc6")],
        "image_alt": "White two-storey house with balconies and palms above a curved pool",
    },
]
