"""Idempotent seed for `properties`.

Run from backend/:  uv run python -m app.db.seed
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.seed_data import SEED_PROPERTIES, seed_id
from app.db.session import SessionLocal
from app.models.property import Property, PropertyStatus


def seed_into(session: Session) -> int:
    """Upsert every seeded listing into `session`. Caller commits."""
    # Explicit timestamps rather than the column's server default. Postgres now()
    # returns the TRANSACTION start time, so inserting all eight rows in one commit
    # would give them an identical created_at and "newest first" would degenerate to
    # arbitrary order. Staggering descending puts the endpoint in the mockup's order.
    base = datetime.now(timezone.utc)

    for position, row in enumerate(SEED_PROPERTIES):
        data = dict(row)
        slug = data.pop("slug")
        # merge() is a PK-keyed upsert: SELECT, then INSERT or UPDATE. Portable (works
        # on the SQLite test database too) and safe to re-run — note it overwrites, so
        # hand edits made directly in the database are reset by the next run.
        session.merge(
            Property(
                id=seed_id(slug),
                status=PropertyStatus.AVAILABLE,
                created_at=base - timedelta(minutes=position),
                **data,
            )
        )

    return len(SEED_PROPERTIES)


def seed() -> int:
    with SessionLocal() as session:
        count = seed_into(session)
        session.commit()
    return count


if __name__ == "__main__":
    print(f"Seeded {seed()} properties.")
