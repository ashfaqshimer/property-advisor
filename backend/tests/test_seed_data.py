"""The seed fixtures themselves — pure data, no database.

Mirrors the frontend's own fixture test. These assertions are what keep the seed
honest against `frontend/lib/properties.ts`.
"""

import re
from uuid import UUID

from app.db.seed_data import SEED_PROPERTIES, seed_id

UNSPLASH_PHOTO = re.compile(r"^https://images\.unsplash\.com/photo-")


def test_seed_has_eight_listings() -> None:
    # PROJECT_OVERVIEW Phase 1 asks for 6-9; the grid renders 8.
    assert len(SEED_PROPERTIES) == 8


def test_slugs_are_unique() -> None:
    slugs = [row["slug"] for row in SEED_PROPERTIES]

    assert len(set(slugs)) == len(slugs)


def test_seed_ids_are_stable_and_distinct() -> None:
    ids = [seed_id(row["slug"]) for row in SEED_PROPERTIES]

    assert len(set(ids)) == len(ids)
    assert all(isinstance(value, UUID) for value in ids)
    # Stability is the whole basis of the merge()-based idempotency.
    assert seed_id("garden-villa-ward-place") == seed_id("garden-villa-ward-place")


def test_every_listing_has_a_positive_price() -> None:
    assert all(row["price"] > 0 for row in SEED_PROPERTIES)


def test_every_listing_has_alt_text_that_is_not_the_title() -> None:
    # The reason image_alt exists as a column at all: alt describes the photo, and
    # frontend/tests/property-grid.test.tsx asserts it differs from the title.
    for row in SEED_PROPERTIES:
        assert row["image_alt"].strip()
        assert row["image_alt"] != row["title"]


def test_every_listing_has_one_allow_listed_image() -> None:
    # next.config.ts only allow-lists images.unsplash.com/photo-**.
    for row in SEED_PROPERTIES:
        assert len(row["image_urls"]) == 1
        assert UNSPLASH_PHOTO.match(row["image_urls"][0])
