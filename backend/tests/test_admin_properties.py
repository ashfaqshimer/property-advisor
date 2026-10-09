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


def test_admin_patch_featured_image_url(authenticated_client: TestClient) -> None:
    property_id = seed_id("garden-villa-ward-place")

    response = authenticated_client.patch(
        f"/admin/properties/{property_id}",
        json={"featured_image_url": "https://example.com/custom-featured.jpg"},
    )

    assert response.status_code == 200
    assert response.json()["featured_image_url"] == "https://example.com/custom-featured.jpg"


def test_admin_properties_include_market_valuation(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/properties")
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    for item in items:
        assert "price_grade" in item
        assert "price_unit_rate" in item
        assert "market_median_unit_rate" in item
        assert "price_diff_percent" in item

    # Single property fetch also includes market valuation
    property_id = seed_id("garden-villa-ward-place")
    single_res = authenticated_client.get(f"/admin/properties/{property_id}")
    assert single_res.status_code == 200
    data = single_res.json()
    assert "price_grade" in data
    assert "price_unit_rate" in data
    assert "market_median_unit_rate" in data


def test_admin_extract_from_text_null_phones_and_defaults(
    authenticated_client: TestClient, monkeypatch
) -> None:
    """Verifies that missing contact info or null booleans does not trigger Pydantic validation failure."""
    from app.models.property import ListingType, PropertyType
    from app.schemas.extractor import GeminiPropertyExtraction

    # Recreate the exact object from the production error log
    mock_extraction = GeminiPropertyExtraction(
        title="Prime Commercial and Residential Building on Galle Road, Dehiwala",
        description="A versatile property situated directly on Galle Road in Dehiwala.",
        listing_type=ListingType.SALE,
        price=160000000.0,
        is_price_per_perch=False,
        location="Dehiwala",
        property_type=PropertyType.MIXED_USE,
        bedrooms=None,
        bathrooms=None,
        land_size_perches=12.0,
        floor_area_sqft=None,
        parking_spaces=6,
        build_year=None,
        road_access_ft=None,
        furnishing_status=None,
        has_maids_room=False,
        has_maids_toilet=False,
        is_gated_community=False,
        amenities=[],
        contact_name=None,
        contact_phone=None,
        contact_phones=None,
        contact_type=None,
        image_alt="Commercial and residential building with parking on Galle Road, Dehiwala",
    )

    class MockExtractor:
        def generate_structured(self, prompt: str, schema: type) -> GeminiPropertyExtraction:
            return mock_extraction

    monkeypatch.setattr("app.api.properties.get_gemini_extractor_client", lambda: MockExtractor())

    pasted_text = (
        "The Commercial and Residential Property on Galle Road, Dehiwala is available for sale. "
        "Land extent: 12 Perches. Parking for 6 vehicles. Expected price: 160 Million LKR."
    )
    response = authenticated_client.post(
        "/admin/properties/extract-from-text",
        json={"text": pasted_text},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Prime Commercial and Residential Building on Galle Road, Dehiwala"
    assert data["price"] == 160000000.0
    assert data["location"] == "Dehiwala"
    assert data["property_type"] == "mixed_use"
    assert data["parking_spaces"] == 6
    assert data["contact_phones"] == []
    assert data["contact_phone"] is None
    assert data["has_maids_room"] is False


def test_admin_extract_from_text_phone_normalization_and_regex_fallback(
    authenticated_client: TestClient, monkeypatch
) -> None:
    """Verifies that phone numbers in raw text or extraction are standardized to Sri Lankan format."""
    from app.models.property import ListingType, PropertyType
    from app.schemas.extractor import GeminiPropertyExtraction

    mock_extraction = GeminiPropertyExtraction(
        title="House in Malabe",
        description="Nice house.",
        listing_type=ListingType.SALE,
        price=35000000.0,
        location="Malabe",
        property_type=PropertyType.HOUSE,
        contact_phones=["+94 77 123 4567"],
    )

    class MockExtractor:
        def generate_structured(self, prompt: str, schema: type) -> GeminiPropertyExtraction:
            return mock_extraction

    monkeypatch.setattr("app.api.properties.get_gemini_extractor_client", lambda: MockExtractor())

    pasted_text = (
        "House in Malabe for sale. Contact 077 123 4567 or 011-2345678."
    )
    response = authenticated_client.post(
        "/admin/properties/extract-from-text",
        json={"text": pasted_text},
    )

    assert response.status_code == 200
    data = response.json()
    assert "0771234567" in data["contact_phones"]
    assert "0112345678" in data["contact_phones"]
    assert data["contact_phone"] == "0771234567"


def test_admin_extract_from_text_amenity_synonyms_and_maid_quarters(
    authenticated_client: TestClient, monkeypatch
) -> None:
    """Verifies amenity synonyms normalize to canonical catalog keys and flags."""
    from app.models.property import ListingType, PropertyType
    from app.schemas.extractor import GeminiPropertyExtraction

    mock_extraction = GeminiPropertyExtraction(
        title="Luxury Villa in Rajagiriya",
        description="Spacious villa with pool and security.",
        listing_type=ListingType.SALE,
        location="Rajagiriya",
        property_type=PropertyType.HOUSE,
        amenities=["a/c", "3 phase", "parapet wall", "maid room"],
    )

    class MockExtractor:
        def generate_structured(self, prompt: str, schema: type) -> GeminiPropertyExtraction:
            return mock_extraction

    monkeypatch.setattr("app.api.properties.get_gemini_extractor_client", lambda: MockExtractor())

    pasted_text = "Luxury Villa in Rajagiriya with AC, 3 Phase electricity, parapet wall, and maid room."
    response = authenticated_client.post(
        "/admin/properties/extract-from-text",
        json={"text": pasted_text},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["amenities"]["ac"] is True
    assert data["amenities"]["three_phase_electricity"] is True
    assert data["amenities"]["boundary_wall"] is True
    assert data["has_maids_room"] is True