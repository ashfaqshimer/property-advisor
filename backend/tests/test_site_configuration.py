"""Tests for site configuration and scanner schedule."""

from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.site_configuration import SiteConfiguration
from app.services.scanner_scheduler import schedule_property_scanner, get_next_scan_time, remove_property_scanner


def test_site_configuration_get_empty(empty_client: TestClient) -> None:
    response = empty_client.get("/site-configuration")
    assert response.status_code == 404


def test_site_configuration_update_and_get_with_scanner(authenticated_client: TestClient, seeded: Session) -> None:
    # Initially create/update site configuration with scanner enabled
    payload = {
        "scanner_settings": {
            "enabled": True,
            "frequency_hours": 12,
            "pages_to_scan": 3,
            "property_types": ["house"],
        }
    }
    update_res = authenticated_client.put("/admin/site-configuration", json=payload)
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["scanner_settings"]["enabled"] is True
    assert data["scanner_settings"]["frequency_hours"] == 12
    assert data["scanner_settings"]["next_run_at"] is not None

    # Fetch configuration via public GET
    get_res = authenticated_client.get("/site-configuration")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["scanner_settings"]["enabled"] is True
    assert get_data["scanner_settings"]["next_run_at"] is not None

    # Disable scanner
    disable_payload = {
        "scanner_settings": {
            "enabled": False,
            "frequency_hours": 12,
            "pages_to_scan": 3,
            "property_types": ["house"],
        }
    }
    disable_res = authenticated_client.put("/admin/site-configuration", json=disable_payload)
    assert disable_res.status_code == 200
    disable_data = disable_res.json()
    assert disable_data["scanner_settings"]["enabled"] is False
    assert disable_data["scanner_settings"]["next_run_at"] is None

    # Clean up
    remove_property_scanner()


def test_schedule_property_scanner_intelligent_next_run() -> None:
    # When last_run_at is None (first enable), it should schedule for immediate run (<= now)
    next_time_none = schedule_property_scanner(24, None)
    assert next_time_none is not None
    assert next_time_none <= datetime.now(timezone.utc) + timedelta(seconds=5)

    # When last_run_at is older than frequency, it should schedule for immediate run (<= now)
    past_time = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
    next_time = schedule_property_scanner(24, past_time)
    assert next_time is not None
    assert next_time <= datetime.now(timezone.utc) + timedelta(seconds=5)

    # When last_run_at was recent, it should schedule for last_run + freq
    recent_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    next_time2 = schedule_property_scanner(6, recent_time)
    assert next_time2 is not None
    # should be roughly 4 hours in the future
    diff_hours = (next_time2 - datetime.now(timezone.utc)).total_seconds() / 3600
    assert 3.5 <= diff_hours <= 4.5

    remove_property_scanner()


def test_scan_presets_crud_and_defaults(authenticated_client: TestClient, seeded: Session) -> None:
    # 1. GET /admin/prospects/presets returns default presets even before config is created
    p_res0 = authenticated_client.get("/admin/prospects/presets")
    assert p_res0.status_code == 200
    p_data0 = p_res0.json()
    assert len(p_data0) >= 4
    assert any(p["id"] == "colombo-7-houses" for p in p_data0)

    # Initialize site config
    init_res = authenticated_client.put("/admin/site-configuration", json={"scanner_settings": {"enabled": False}})
    assert init_res.status_code == 200

    # 2. GET /site-configuration returns default presets
    res = authenticated_client.get("/site-configuration")
    assert res.status_code == 200
    data = res.json()
    presets = data["scanner_settings"]["presets"]
    assert len(presets) >= 4
    preset_ids = [p["id"] for p in presets]
    assert "colombo-7-houses" in preset_ids

    # 2. GET /admin/prospects/presets
    p_res = authenticated_client.get("/admin/prospects/presets")
    assert p_res.status_code == 200
    p_data = p_res.json()
    assert len(p_data) == len(presets)

    # 3. POST /admin/prospects/presets (add new preset)
    new_preset = {
        "id": "kandy-villas",
        "name": "Kandy Hill Villas",
        "keyword": "Kandy",
        "property_category": "houses",
        "strict_location": True,
        "scan_all": True,
        "source": "ikman",
        "is_default": False,
    }
    create_res = authenticated_client.post("/admin/prospects/presets", json=new_preset)
    assert create_res.status_code == 200
    updated_presets = create_res.json()
    assert any(p["id"] == "kandy-villas" for p in updated_presets)

    # 4. Verify GET /site-configuration reflects the new preset in config collection
    get_res = authenticated_client.get("/site-configuration")
    assert any(p["id"] == "kandy-villas" for p in get_res.json()["scanner_settings"]["presets"])

    # 5. DELETE /admin/prospects/presets/kandy-villas
    del_res = authenticated_client.delete("/admin/prospects/presets/kandy-villas")
    assert del_res.status_code == 200
    remaining_presets = del_res.json()
    assert not any(p["id"] == "kandy-villas" for p in remaining_presets)
