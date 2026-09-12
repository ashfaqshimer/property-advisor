from uuid import UUID

from fastapi.testclient import TestClient

from app.db.seed_data import seed_id


def test_admin_list_includes_unavailable_rows_and_filters(client: TestClient) -> None:
    response = client.get("/admin/properties", params={"search": "Colombo 3"})

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["Skyline Penthouse"]


def test_admin_get_returns_a_property(client: TestClient) -> None:
    response = client.get(f"/admin/properties/{seed_id('garden-villa-ward-place')}")

    assert response.status_code == 200
    assert UUID(response.json()["id"])
    assert response.json()["title"] == "Garden Villa on Ward Place"


def test_admin_patch_updates_featured_and_status(client: TestClient) -> None:
    property_id = seed_id("garden-villa-ward-place")

    response = client.patch(
        f"/admin/properties/{property_id}",
        json={"is_featured": False, "status": "under_offer"},
    )

    assert response.status_code == 200
    assert response.json()["is_featured"] is False
    assert response.json()["status"] == "under_offer"


def test_admin_delete_removes_a_property(client: TestClient) -> None:
    property_id = seed_id("garden-villa-ward-place")

    response = client.delete(f"/admin/properties/{property_id}")

    assert response.status_code == 204
    assert client.get(f"/admin/properties/{property_id}").status_code == 404


def test_admin_missing_property_is_404(client: TestClient) -> None:
    response = client.get("/admin/properties/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404