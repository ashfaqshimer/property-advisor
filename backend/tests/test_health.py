"""Guards the router include and CORS middleware from breaking the app entirely."""

from fastapi.testclient import TestClient


def test_health_returns_ok(empty_client: TestClient) -> None:
    response = empty_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_preflight_allows_the_configured_origin(empty_client: TestClient) -> None:
    response = empty_client.options(
        "/properties/featured",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
