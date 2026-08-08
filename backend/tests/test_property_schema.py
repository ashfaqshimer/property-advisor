"""The wire contract.

Asserted on raw JSON rather than the parsed model — a Pydantic round-trip would
happily hide the Decimal-serializes-as-a-string default this is here to catch.
"""

from uuid import UUID

from fastapi.testclient import TestClient

EXPECTED_KEYS = {
    "id",
    "title",
    "description",
    "price",
    "currency",
    "location",
    "property_type",
    "bedrooms",
    "bathrooms",
    "sqft",
    "image_urls",
    "image_alt",
    "status",
    "created_at",
}


def _first(client: TestClient) -> dict:
    response = client.get("/properties/featured")
    assert response.status_code == 200
    return response.json()[0]


def test_price_is_a_json_number_not_a_string(client: TestClient) -> None:
    price = _first(client)["price"]

    assert isinstance(price, (int, float))
    assert not isinstance(price, str)
    assert price == 185000000.0


def test_currency_is_present(client: TestClient) -> None:
    assert _first(client)["currency"] == "LKR"


def test_field_names_are_snake_case_and_complete(client: TestClient) -> None:
    assert set(_first(client).keys()) == EXPECTED_KEYS


def test_id_is_a_uuid(client: TestClient) -> None:
    UUID(_first(client)["id"])


def test_image_fields_have_the_expected_shape(client: TestClient) -> None:
    item = _first(client)

    assert isinstance(item["image_urls"], list)
    assert item["image_urls"][0].startswith("https://images.unsplash.com/photo-")
    assert item["image_alt"]
    assert item["image_alt"] != item["title"]


def test_enums_serialize_as_lowercase_values(client: TestClient) -> None:
    item = _first(client)

    assert item["property_type"] == "house"
    assert item["status"] == "available"


def test_nullable_dimensions_are_present_even_when_set(client: TestClient) -> None:
    item = _first(client)

    assert item["bedrooms"] == 5
    assert item["bathrooms"] == 4
    assert item["sqft"] == 4200
