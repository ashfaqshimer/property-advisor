from datetime import datetime, timezone, timedelta
from typing import Generator
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.scan_job import ScanJob


def test_admin_prospects_requires_authentication(client: TestClient) -> None:
    assert client.get("/admin/prospects").status_code == 401
    assert client.get("/admin/prospects/scan/active").status_code == 401


def test_get_prospects_empty(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/prospects")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 0
    assert data["total"] == 0


def test_get_active_jobs_empty(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()
    assert data["scan"] is None
    assert data["phone_fetch"] is None
    assert data["last_scan_at"] is None
    assert data["last_phone_fetch_at"] is None


def test_get_active_jobs_stuck_job_timeout(authenticated_client: TestClient, db_session: Session) -> None:
    # Create a stuck running job created 2 hours ago
    stuck_time = datetime.now(timezone.utc) - timedelta(hours=2)
    job_id = uuid.uuid4()
    stuck_job = ScanJob(
        id=job_id,
        job_type="scan",
        status="running",
        progress="Starting up...",
        created_at=stuck_time,
        updated_at=stuck_time,
        created_by_name="root"
    )
    db_session.add(stuck_job)
    db_session.commit()

    # Call the endpoint
    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()

    # Job should be failed and NOT returned as active
    assert data["scan"] is None
    
    # Verify in DB it was marked as failed
    db_session.refresh(stuck_job)
    assert stuck_job.status == "failed"
    assert "Job timed out" in str(stuck_job.error)


def test_get_active_jobs_returns_root_info(authenticated_client: TestClient, db_session: Session) -> None:
    # Create a completed scan job
    job_id = uuid.uuid4()
    recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    completed_job = ScanJob(
        id=job_id,
        job_type="scan",
        status="completed",
        progress="Done",
        created_at=recent_time,
        updated_at=recent_time,
        created_by_name="root user"
    )
    db_session.add(completed_job)
    db_session.commit()

    response = authenticated_client.get("/admin/prospects/scan/active")
    assert response.status_code == 200
    data = response.json()
    
    assert data["last_scan_at"] is not None
    assert data["last_scan_by"] == "root user"


def test_prospect_suburb_search_and_enrichment(authenticated_client: TestClient, db_session: Session) -> None:
    from app.models.prospect import Prospect
    from app.api.prospects import _enrich_location_from_detail
    from app.scraper.schemas import IkmanAdDetail, IkmanLocation

    prospect = Prospect(
        ikman_ad_id="ad-piliyandala-1",
        ikman_url="https://ikman.lk/en/ad/piliyandala-house",
        ikman_slug="piliyandala-house-for-sale-colombo",
        title="Modern House for Sale",
        price="Rs 25,000,000",
        location="Colombo",
        suburb="Piliyandala",
        suburb_source="extracted",
        property_type="house",
        listing_type="sale",
        classification="owner",
        confidence=90,
        classification_reasons=["no_membership_no_shop"],
        classification_method="heuristic",
        status="new",
    )
    db_session.add(prospect)
    db_session.commit()

    # 1. Fetch prospects and verify suburb fields are returned
    resp = authenticated_client.get("/admin/prospects")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["suburb"] == "Piliyandala"
    assert items[0]["suburb_source"] == "extracted"

    # 2. Search by suburb
    search_resp = authenticated_client.get("/admin/prospects?q=Piliyandala")
    assert search_resp.status_code == 200
    search_items = search_resp.json()["items"]
    assert len(search_items) == 1
    assert search_items[0]["id"] == str(prospect.id)

    # 3. Test _enrich_location_from_detail with authoritative ikman detail
    detail = IkmanAdDetail(
        id="ad-piliyandala-1",
        location=IkmanLocation(name="Piliyandala", parent={"id": 1506, "name": "Colombo"}),
    )
    changed = _enrich_location_from_detail(db_session, prospect, detail)
    assert changed is True
    assert prospect.suburb == "Piliyandala"
    assert prospect.suburb_source == "ikman_detail"
    assert prospect.location == "Colombo"


def test_is_location_relevant() -> None:
    from app.api.prospects import is_location_relevant
    from app.scraper.schemas import IkmanAd

    # Test title match
    ad1 = IkmanAd(id="1", slug="modern-house-sale", title="Luxury House in Rajagiriya")
    assert is_location_relevant(ad1, "rajagiriya", None) is True
    assert is_location_relevant(ad1, "kandy", None) is False

    # Test slug match
    ad2 = IkmanAd(id="2", slug="apartment-in-battaramulla-for-sale", title="Beautiful 3 Bed Unit")
    assert is_location_relevant(ad2, "battaramulla", None) is True

    # Test extracted suburb match
    ad3 = IkmanAd(id="3", slug="house-near-waterfront", title="Spacious family home")
    assert is_location_relevant(ad3, "Nugegoda", "Nugegoda") is True
    assert is_location_relevant(ad3, "Negombo", "Nugegoda") is False

    # Test canonical suburb match (e.g. Colombo 03 vs Colombo 3)
    ad4 = IkmanAd(id="4", slug="sea-view-flat", title="Penthouse Apartment")
    assert is_location_relevant(ad4, "Colombo 03", "Colombo 3") is True


def test_start_scoped_scan_creates_job(authenticated_client: TestClient) -> None:
    from unittest.mock import patch
    payload = {
        "keyword": "Rajagiriya",
        "property_category": "houses",
        "pages_per_category": 2,
        "strict_location": True,
    }
    with patch("app.api.prospects._run_scan_job"):
        resp = authenticated_client.post("/admin/prospects/scan", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data

        # Check status
        status_resp = authenticated_client.get(f"/admin/prospects/scan/{data['job_id']}/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["status"] == "running"
        assert "Rajagiriya" in status_data["progress"]


def test_start_scan_with_long_categories_list_lpw(authenticated_client: TestClient) -> None:
    from unittest.mock import patch
    payload = {
        "source": "lpw",
        "categories": [
            "land-for-sale",
            "houses-for-sale",
            "apartments-for-sale",
            "house-rentals",
            "apartment-rentals",
        ],
        "pages_per_category": 3,
    }
    with patch("app.api.prospects._run_scan_job"):
        resp = authenticated_client.post("/admin/prospects/scan", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "job_id" in data

        # Check status
        status_resp = authenticated_client.get(f"/admin/prospects/scan/{data['job_id']}/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["status"] == "running"


def test_resolve_ikman_location_slug() -> None:
    from app.scraper.ikman_locations import resolve_ikman_location_slug

    # Exact official slugs & names
    assert resolve_ikman_location_slug("Dehiwala") == "dehiwala"
    assert resolve_ikman_location_slug("dehiwala") == "dehiwala"
    assert resolve_ikman_location_slug("Rajagiriya") == "rajagiriya"
    assert resolve_ikman_location_slug("Colombo 6") == "colombo-6"
    assert resolve_ikman_location_slug("Galle") == "galle"

    # Aliases & common misspellings
    assert resolve_ikman_location_slug("dehiwela") == "dehiwala"
    assert resolve_ikman_location_slug("thalawathugoda") == "talawatugoda"
    assert resolve_ikman_location_slug("wellawatte") == "colombo-6"
    assert resolve_ikman_location_slug("kollupitiya") == "colombo-3"
    assert resolve_ikman_location_slug("colpetty") == "colombo-3"
    assert resolve_ikman_location_slug("bambalapitiya") == "colombo-4"
    assert resolve_ikman_location_slug("havelock town") == "colombo-5"
    assert resolve_ikman_location_slug("mt lavinia") == "mount-lavinia"

    # Unmapped location falls back to None
    assert resolve_ikman_location_slug("Custom Private Road") is None
    assert resolve_ikman_location_slug(None) is None
    assert resolve_ikman_location_slug("") is None


def test_save_prospects_with_native_location(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    from contextlib import contextmanager
    from app.api.prospects import _save_prospects_sync
    from app.models.prospect import Prospect
    from app.schemas.prospect import ScanRequest
    from app.scraper.schemas import IkmanAd

    @contextmanager
    def mock_session():
        yield db_session

    monkeypatch.setattr("app.api.prospects.SessionLocal", mock_session)
    monkeypatch.setattr("app.api.prospects.geocode_location", lambda db, target: (6.85, 79.86))

    # Ad without "Dehiwala" in title
    ad_native = IkmanAd(
        id="ikman-native-1",
        slug="modern-luxury-house-for-sale",
        title="Modern Luxury House for Sale",
        location="Colombo",
    )
    request = ScanRequest(keyword="dehiwela", strict_location=True)

    # 1. Saved with native location: should NOT be discarded
    found, new_c, known_c, fl_c = _save_prospects_sync(
        [ad_native], request, native_location_slug="dehiwala"
    )
    assert found == 1
    assert new_c == 1
    assert fl_c == 0

    prospect = db_session.query(Prospect).filter_by(ikman_ad_id="ikman-native-1").first()
    assert prospect is not None
    assert prospect.status == "new"
    assert prospect.suburb == "Dehiwala"
    assert prospect.suburb_source == "ikman_location"

    # 2. Ad without native location matching keyword: should be discarded as location_mismatch
    ad_fallback = IkmanAd(
        id="ikman-fallback-1",
        slug="panadura-house-near-colombo",
        title="House in Panadura easy access to Colombo",
        location="Kalutara",
    )
    req_fallback = ScanRequest(keyword="dehiwela", strict_location=True)
    found2, new_c2, known_c2, fl_c2 = _save_prospects_sync(
        [ad_fallback], req_fallback, native_location_slug=None
    )
    assert found2 == 1
    assert fl_c2 == 1
    prospect2 = db_session.query(Prospect).filter_by(ikman_ad_id="ikman-fallback-1").first()
    assert prospect2 is not None
    assert prospect2.status == "discarded"
    assert prospect2.discard_reason == "location_mismatch"


