from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed_data import seed_id
from app.geocoding import Coordinates
from app.models import Property


def test_admin_properties_require_authentication(client: TestClient) -> None:
    assert client.get("/admin/properties").status_code == 401
    assert client.get(f"/admin/properties/{seed_id('garden-villa-ward-place')}").status_code == 401


def test_admin_list_includes_unavailable_rows_and_filters(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/properties", params={"search": "Colombo 3"})

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["Skyline Penthouse"]


def test_admin_get_returns_a_property(authenticated_client: TestClient) -> None:
    response = authenticated_client.get(f"/admin/properties/{seed_id('garden-villa-ward-place')}")

    assert response.status_code == 200
    assert UUID(response.json()["id"])
    assert response.json()["title"] == "Garden Villa on Ward Place"


def test_admin_patch_updates_featured_and_status(authenticated_client: TestClient) -> None:
    property_id = seed_id("garden-villa-ward-place")

    response = authenticated_client.patch(
        f"/admin/properties/{property_id}",
        json={"is_featured": False, "status": "under_offer"},
    )

    assert response.status_code == 200
    assert response.json()["is_featured"] is False
    assert response.json()["status"] == "under_offer"


def test_admin_location_update_persists_geocoded_coordinates(
    authenticated_client: TestClient, seeded: Session, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.api.properties._geocode_location",
        lambda _location: Coordinates(latitude=6.89, longitude=79.87),
    )

    response = authenticated_client.patch(
        f"/admin/properties/{seed_id('garden-villa-ward-place')}",
        json={"location": "Havelock City"},
    )

    assert response.status_code == 200
    property_record = seeded.get(Property, seed_id("garden-villa-ward-place"))
    assert property_record.location == "Havelock City"
    assert property_record.latitude == 6.89
    assert property_record.longitude == 79.87


def test_admin_location_update_rejects_unresolved_location(
    authenticated_client: TestClient, monkeypatch
) -> None:
    from fastapi import HTTPException

    def reject(_location):
        raise HTTPException(status_code=422, detail="The property location could not be resolved.")

    monkeypatch.setattr("app.api.properties._geocode_location", reject)

    response = authenticated_client.patch(
        f"/admin/properties/{seed_id('garden-villa-ward-place')}",
        json={"location": "Not A Real Place"},
    )

    assert response.status_code == 422


def test_admin_delete_removes_a_property(authenticated_client: TestClient) -> None:
    property_id = seed_id("garden-villa-ward-place")

    response = authenticated_client.delete(f"/admin/properties/{property_id}")

    assert response.status_code == 204
    assert authenticated_client.get(f"/admin/properties/{property_id}").status_code == 404


def test_admin_missing_property_is_404(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/properties/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


def test_admin_extract_from_text_requires_auth(client: TestClient) -> None:
    response = client.post("/admin/properties/extract-from-text", json={"text": "some listing text"})
    assert response.status_code == 401


def test_admin_extract_from_text_validation_error(authenticated_client: TestClient) -> None:
    response = authenticated_client.post("/admin/properties/extract-from-text", json={"text": "hi"})
    assert response.status_code == 422


def test_admin_extract_from_text_success(authenticated_client: TestClient, monkeypatch) -> None:
    from app.models.property import ListingType, PropertyType
    from app.schemas.extractor import GeminiPropertyExtraction

    mock_extraction = GeminiPropertyExtraction(
        title="Modern 3-Bedroom House in Homagama",
        description="Newly built modern two-story house in Homagama.",
        listing_type=ListingType.SALE,
        price=22000000.0,
        is_price_per_perch=False,
        location="Homagama",
        property_type=PropertyType.HOUSE,
        bedrooms=3,
        bathrooms=2,
        land_size_perches=10.0,
        floor_area_sqft=1600,
        parking_spaces=2,
        amenities=["garden"],
        has_maids_room=False,
        has_maids_toilet=True,
        is_gated_community=False,
        contact_name="Ranjith",
        contact_phone="0771234567",
        contact_type="owner",
        image_alt="Two-story house with front garden",
    )

    class MockExtractor:
        def generate_structured(self, prompt: str, schema: type) -> GeminiPropertyExtraction:
            return mock_extraction

    monkeypatch.setattr("app.api.properties.get_gemini_extractor_client", lambda: MockExtractor())

    sinhala_text = (
        "හෝමාගම පර්චස් 10ක ඉඩම සහ කාමර 3ක අලුත් නිවස විකිණීමට. "
        "ලක්ෂ 220යි. නාන කාමර 2, සේවක වැසිකිළිය ඇත. අමතන්න රංජිත් 0771234567"
    )
    response = authenticated_client.post(
        "/admin/properties/extract-from-text",
        json={"text": sinhala_text},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Modern 3-Bedroom House in Homagama"
    assert data["price"] == 22000000.0
    assert data["location"] == "Homagama"
    assert data["bedrooms"] == 3
    assert data["bathrooms"] == 2
    assert data["land_size_perches"] == 10.0
    assert data["has_maids_toilet"] is True
    assert data["amenities"] == {"garden": True}
    assert data["contact_name"] == "Ranjith"
    assert data["contact_phone"] == "0771234567"
    assert data["contact_type"] == "owner"