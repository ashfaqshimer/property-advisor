"""Tests for admin property photo download endpoints."""

import io
import zipfile
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import httpx
import pytest

from app.db.seed_data import SEED_PROPERTIES, seed_id


def test_download_endpoints_require_authentication(client: TestClient) -> None:
    # Public router must NOT expose photo download endpoints
    assert client.get("/properties/download-image", params={"url": "https://example.com/test.jpg"}).status_code == 404
    assert client.get("/properties/PA-1001/photos/zip").status_code == 404

    # Admin endpoints require auth
    assert client.get("/admin/properties/download-image", params={"url": "https://example.com/test.jpg"}).status_code == 401
    assert client.get("/admin/properties/PA-1001/photos/zip").status_code == 401


def test_download_endpoints_forbidden_for_agents(agent_client: TestClient) -> None:
    # Agents are forbidden from downloading photos
    resp_img = agent_client.get("/admin/properties/download-image", params={"url": "https://example.com/test.jpg"})
    assert resp_img.status_code == 403
    assert "Admin or Root access required" in resp_img.json()["detail"]

    resp_zip = agent_client.get("/admin/properties/PA-1001/photos/zip")
    assert resp_zip.status_code == 403
    assert "Admin or Root access required" in resp_zip.json()["detail"]


def test_download_image_invalid_url_rejected(authenticated_client: TestClient) -> None:
    resp = authenticated_client.get("/admin/properties/download-image", params={"url": "ftp://example.com/test.jpg"})
    assert resp.status_code == 400


def test_download_image_disallowed_host_rejected(authenticated_client: TestClient) -> None:
    resp = authenticated_client.get("/admin/properties/download-image", params={"url": "http://localhost:8000/secret.jpg"})
    assert resp.status_code == 400
    assert "Disallowed" in resp.json()["detail"]


def test_download_image_success_for_admin(authenticated_client: TestClient) -> None:
    mock_response = httpx.Response(
        status_code=200,
        content=b"fake-image-bytes",
        headers={"content-type": "image/jpeg"},
        request=httpx.Request("GET", "https://example.com/photo.jpg"),
    )
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        resp = authenticated_client.get(
            "/admin/properties/download-image",
            params={"url": "https://example.com/photo.jpg", "filename": "my-villa.jpg"},
        )
        assert resp.status_code == 200
        assert resp.content == b"fake-image-bytes"
        assert "attachment" in resp.headers["content-disposition"]
        assert "my-villa.jpg" in resp.headers["content-disposition"]


def test_download_photos_zip_not_found(authenticated_client: TestClient) -> None:
    resp = authenticated_client.get("/admin/properties/00000000-0000-0000-0000-000000000000/photos/zip")
    assert resp.status_code == 404


def test_download_photos_zip_success_for_admin(authenticated_client: TestClient) -> None:
    prop_id = str(seed_id("garden-villa-ward-place"))
    mock_response = httpx.Response(
        status_code=200,
        content=b"fake-image-content-for-zip",
        headers={"content-type": "image/jpeg"},
        request=httpx.Request("GET", "https://images.unsplash.com/photo-1613490493576"),
    )
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        resp = authenticated_client.get(f"/admin/properties/{prop_id}/photos/zip")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        assert "attachment" in resp.headers["content-disposition"]
        assert ".zip" in resp.headers["content-disposition"]

        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        namelist = zf.namelist()
        assert len(namelist) >= 1
        assert namelist[0].endswith(".jpg")
        assert zf.read(namelist[0]) == b"fake-image-content-for-zip"


def test_download_photos_zip_by_property_code(authenticated_client: TestClient) -> None:
    mock_response = httpx.Response(
        status_code=200,
        content=b"fake-image-content-code",
        headers={"content-type": "image/jpeg"},
        request=httpx.Request("GET", "https://images.unsplash.com/photo-1613490493576"),
    )
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        resp = authenticated_client.get("/admin/properties/PA-1001/photos/zip")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        assert len(zf.namelist()) >= 1
