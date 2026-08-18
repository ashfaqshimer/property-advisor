"""Read queries for `properties`.

**Reversed decision:** this docstring used to say filtered search "deliberately lives with
the Phase 2 `search_properties` tool rather than here". It lives here now. The agent tool
is one caller; the Phase 3 `GET /properties` endpoint is another, and an HTTP endpoint
importing from `app.agent` to answer a listings request would have the dependency arrow
backwards. `app/agent/tools.py` wraps this for Gemini rather than reimplementing it.
"""

from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.property import Property, PropertyStatus, PropertyType

# The homepage grid renders eight cards.
DEFAULT_FEATURED_LIMIT = 8
MAX_FEATURED_LIMIT = 24

# What one tool response shows the model, per PROJECT_OVERVIEW §5. Small on purpose: every
# row goes back into the prompt as tokens, and a model handed twenty listings summarises
# instead of recommending.
DEFAULT_SEARCH_LIMIT = 5


def featured_properties(
    db: Session, limit: int = DEFAULT_FEATURED_LIMIT
) -> Sequence[Property]:
    """The homepage set: the newest still-available listings.

    There is no `featured` flag, deliberately. With eight listings a boolean column
    would be true on every row and encode nothing. When there are more listings than
    the grid holds, "featured" becomes a real editorial decision and earns a column;
    until then "newest, still for sale" is the honest rule.

    `id` is the tiebreaker, not decoration: see the note on transaction clocks in
    app/db/seed.py.
    """
    stmt = (
        select(Property)
        .where(Property.status == PropertyStatus.AVAILABLE)
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
    property_type: PropertyType | None = None,
    bedrooms: int | None = None,
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

    if location:
        stmt = stmt.where(Property.location.ilike(f"%{location.strip()}%"))
    if budget_min is not None:
        stmt = stmt.where(Property.price >= budget_min)
    if budget_max is not None:
        stmt = stmt.where(Property.price <= budget_max)
    if property_type is not None:
        stmt = stmt.where(Property.property_type == property_type)
    if bedrooms is not None:
        stmt = stmt.where(Property.bedrooms >= bedrooms)

    stmt = stmt.order_by(Property.created_at.desc(), Property.id).limit(limit)
    return db.execute(stmt).scalars().all()
