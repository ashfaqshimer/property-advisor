"""GET /properties/featured — behaviour."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed_data import SEED_PROPERTIES, seed_id
from app.models.property import Property, PropertyStatus


def test_returns_all_eight_by_default(client: TestClient) -> None:
    response = client.get("/properties/featured")

    assert response.status_code == 200
    assert len(response.json()) == 8


def test_limit_narrows_the_result(client: TestClient) -> None:
    response = client.get("/properties/featured", params={"limit": 3})

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_limit_out_of_bounds_is_rejected(client: TestClient) -> None:
    assert client.get("/properties/featured", params={"limit": 0}).status_code == 422
    assert client.get("/properties/featured", params={"limit": 99}).status_code == 422


def test_limit_beyond_the_row_count_returns_what_exists(client: TestClient) -> None:
    response = client.get("/properties/featured", params={"limit": 24})

    assert response.status_code == 200
    assert len(response.json()) == 8


def test_empty_table_returns_an_empty_list_not_a_404(empty_client: TestClient) -> None:
    response = empty_client.get("/properties/featured")

    assert response.status_code == 200
    assert response.json() == []


def test_order_matches_the_homepage_grid(client: TestClient) -> None:
    titles = [item["title"] for item in client.get("/properties/featured").json()]

    assert titles == [row["title"] for row in SEED_PROPERTIES]


def test_sold_and_under_offer_listings_are_excluded(
    client: TestClient, seeded: Session
) -> None:
    sold = seeded.get(Property, seed_id("skyline-penthouse"))
    under_offer = seeded.get(Property, seed_id("hillside-bungalow"))
    assert sold is not None and under_offer is not None
    sold.status = PropertyStatus.SOLD
    under_offer.status = PropertyStatus.UNDER_OFFER
    seeded.commit()

    titles = [item["title"] for item in client.get("/properties/featured").json()]

    assert len(titles) == 6
    assert "Skyline Penthouse" not in titles
    assert "Hillside Bungalow" not in titles


def test_enum_values_are_stored_lowercase(seeded: Session) -> None:
    # Without values_callable on the SAEnum, SQLAlchemy persists the member NAME
    # ("HOUSE"), and every lowercase filter silently matches nothing.
    listing = seeded.get(Property, seed_id("garden-villa-ward-place"))
    assert listing is not None

    assert listing.property_type.value == "house"
    assert listing.status.value == "available"


def test_reseeding_does_not_duplicate_rows(seeded: Session) -> None:
    from app.db.seed import seed_into

    seed_into(seeded)
    seeded.commit()

    assert seeded.query(Property).count() == 8
