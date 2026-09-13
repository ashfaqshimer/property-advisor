"""Populate missing property coordinates.

Run from backend/: ``uv run python -m app.db.backfill_locations``.
"""

from sqlalchemy import select

from app.config import get_settings
from app.db.session import SessionLocal
from app.geocoding import GeocodingError, GoogleGeocoder
from app.models.property import Property


def backfill() -> tuple[int, int]:
    settings = get_settings()
    geocoder = GoogleGeocoder(settings.google_maps_api_key)
    updated = 0
    failed = 0

    with SessionLocal() as session:
        properties = session.scalars(
            select(Property).where(
                Property.latitude.is_(None) | Property.longitude.is_(None)
            )
        ).all()
        for property_record in properties:
            try:
                coordinates = geocoder.geocode(property_record.location)
            except GeocodingError as exc:
                failed += 1
                print(f"FAILED {property_record.id} {property_record.location}: {exc}")
                continue
            if coordinates is None:
                failed += 1
                print(f"FAILED {property_record.id} {property_record.location}: no result")
                continue
            property_record.latitude = coordinates.latitude
            property_record.longitude = coordinates.longitude
            updated += 1
        session.commit()

    return updated, failed


if __name__ == "__main__":
    updated, failed = backfill()
    print(f"Backfilled {updated} properties; {failed} failed.")