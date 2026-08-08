"""Read queries for `properties`.

Filtered search (location, budget, type, bedrooms) deliberately lives with the Phase 2
`search_properties` tool rather than here — one implementation, in the place that
actually needs it.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.property import Property, PropertyStatus

# The homepage grid renders eight cards.
DEFAULT_FEATURED_LIMIT = 8
MAX_FEATURED_LIMIT = 24


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
