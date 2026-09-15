"""Read queries for `properties`.

**Reversed decision:** this docstring used to say filtered search "deliberately lives with
the Phase 2 `search_properties` tool rather than here". It lives here now. The agent tool
is one caller; the Phase 3 `GET /properties` endpoint is another, and an HTTP endpoint
importing from `app.agent` to answer a listings request would have the dependency arrow
backwards. `app/agent/tools.py` wraps this for Gemini rather than reimplementing it.
"""

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import cast, func, select
from sqlalchemy.types import UserDefinedType
from sqlalchemy.orm import Session

from app.models.property import ListingType, Property, PropertyStatus, PropertyType

# The homepage grid renders eight cards.
DEFAULT_FEATURED_LIMIT = 6
MAX_FEATURED_LIMIT = 6

# What one tool response shows the model, per PROJECT_OVERVIEW §5. Small on purpose: every
# row goes back into the prompt as tokens, and a model handed twenty listings summarises
# instead of recommending.
DEFAULT_SEARCH_LIMIT = 5


class Geography(UserDefinedType):
    """PostGIS geography type used only in PostgreSQL query expressions."""

    cache_ok = True

    def get_col_spec(self, **_):
        return "geography"


def featured_properties(
    db: Session, limit: int = DEFAULT_FEATURED_LIMIT
) -> Sequence[Property]:
    """The homepage set: the newest still-available listings.

    `id` is the tiebreaker, not decoration: see the note on transaction clocks in
    app/db/seed.py.
    """
    stmt = (
        select(Property)
        .where(
            Property.status == PropertyStatus.AVAILABLE,
            Property.is_featured.is_(True),
        )
        .order_by(Property.created_at.desc(), Property.id)
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


def search_properties(
    db: Session,
    *,
    location: str | None = None,
    budget_min: Decimal | None = None,
    budget_max: Decimal | None = None,
    listing_type: ListingType | None = None,
    property_type: PropertyType | None = None,
    bedrooms: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: float | None = None,
    limit: int = DEFAULT_SEARCH_LIMIT,
) -> Sequence[Property]:
    """Listings matching whatever criteria were supplied.

    Every filter is optional and each one only narrows: passing nothing returns the newest
    available listings, which is the right answer to "what have you got?".

    Three choices worth knowing about:

    - **`available` only.** A sold house is not a search result. The agent describing one
      would be technically truthful and practically a waste of everyone's time.
    - **`location` is a case-insensitive substring match**, not equality. Locations are
      free text ("Colombo 5", "Rajagiriya") and the model relays whatever the user typed,
      so `ilike` absorbs "colombo 5" and "Colombo" alike. `Colombo` matching all seven
      Colombo listings is the intended behaviour, not sloppiness.
    - **`bedrooms` is a floor, not equality.** Someone asking for three bedrooms is not
      insulted by a four-bedroom house inside their budget. `NULL` bedrooms (land,
      commercial) drop out, which is correct — a plot has no bedroom count to satisfy.

    Ordering matches `featured_properties`: newest first, `id` as the tiebreaker, because
    Postgres now() is transaction-start time and the seeded rows share a timestamp.
    """
    stmt = select(Property).where(Property.status == PropertyStatus.AVAILABLE)

    if latitude is not None and longitude is not None and radius_km is not None:
        property_point = cast(
            func.ST_SetSRID(
                func.ST_MakePoint(Property.longitude, Property.latitude), 4326
            ),
            Geography(),
        )
        search_point = cast(
            func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326), Geography()
        )
        stmt = stmt.where(
            func.ST_DWithin(property_point, search_point, radius_km * 1000)
        )
    elif location:
        stmt = stmt.where(Property.location.ilike(f"%{location.strip()}%"))
    if budget_min is not None:
        stmt = stmt.where(Property.price >= budget_min)
    if budget_max is not None:
        stmt = stmt.where(Property.price <= budget_max)
    if listing_type is not None:
        stmt = stmt.where(Property.listing_type == listing_type)
    if property_type is not None:
        stmt = stmt.where(Property.property_type == property_type)
    if bedrooms is not None:
        stmt = stmt.where(Property.bedrooms >= bedrooms)

    stmt = stmt.order_by(Property.created_at.desc(), Property.id).limit(limit)
    return db.execute(stmt).scalars().all()


def available_property_by_id(db: Session, property_id: uuid.UUID) -> Property | None:
    """Return one available listing by its stable public id."""
    stmt = select(Property).where(
        Property.id == property_id,
        Property.status == PropertyStatus.AVAILABLE,
    )
    return db.execute(stmt).scalar_one_or_none()


def admin_properties(
    db: Session,
    *,
    search: str | None = None,
    status: PropertyStatus | None = None,
    property_type: PropertyType | None = None,
    listing_type: ListingType | None = None,
    is_featured: bool | None = None,
    offset: int = 0,
    limit: int = 50,
) -> Sequence[Property]:
    """Return catalog rows for the management surface, including unavailable rows."""
    stmt = select(Property)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(Property.title.ilike(term) | Property.location.ilike(term))
    if status is not None:
        stmt = stmt.where(Property.status == status)
    if property_type is not None:
        stmt = stmt.where(Property.property_type == property_type)
    if listing_type is not None:
        stmt = stmt.where(Property.listing_type == listing_type)
    if is_featured is not None:
        stmt = stmt.where(Property.is_featured == is_featured)

    stmt = stmt.order_by(Property.created_at.desc(), Property.id).offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()
