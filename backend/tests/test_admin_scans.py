import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.prospect import Prospect
from app.models.scan_job import ScanJob


def test_list_scans_empty(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/admin/prospects/scans")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_scan_lifecycle_and_details(authenticated_client: TestClient, db_session: Session) -> None:
    job_id = uuid.uuid4()
    job = ScanJob(
        id=job_id,
        job_type="scan",
        status="completed",
        progress="Done. Scanned 4 pages, found 50 listings (10 new, 5 filtered).",
        keyword="Colombo 03",
        property_category="apartments",
        pages_scanned=4,
        total_pages=4,
        total_found=50,
        new_count=10,
        updated_count=35,
        filtered_count=5,
        duration_seconds=12.4,
        created_by_name="root",
    )
    db_session.add(job)

    # Add 2 prospects linked to this scan
    p1 = Prospect(
        ikman_ad_id="ad-1",
        ikman_url="https://ikman.lk/en/ad/ad-1",
        ikman_slug="ad-1",
        title="Luxury Apartment Colombo 3",
        price="Rs 45,000,000",
        location="Colombo",
        suburb="Colombo 3",
        property_type="apartment",
        listing_type="sale",
        classification="owner",
        confidence=95,
        classification_reasons=["private_seller"],
        classification_method="heuristic",
        first_scan_job_id=job_id,
        phone_number=None,
    )
    p2 = Prospect(
        ikman_ad_id="ad-2",
        ikman_url="https://ikman.lk/en/ad/ad-2",
        ikman_slug="ad-2",
        title="Sea View Flat Kollupitiya",
        price="Rs 350,000 /month",
        location="Colombo",
        suburb="Kollupitiya",
        property_type="apartment",
        listing_type="rent",
        classification="owner",
        confidence=90,
        classification_reasons=["individual_contact"],
        classification_method="heuristic",
        first_scan_job_id=job_id,
        phone_number="0771234567",
    )
    # And 1 unlinked prospect
    p3 = Prospect(
        ikman_ad_id="ad-3",
        ikman_url="https://ikman.lk/en/ad/ad-3",
        ikman_slug="ad-3",
        title="Unrelated Land Kandy",
        price="Rs 10,000,000",
        location="Kandy",
        property_type="land",
        listing_type="sale",
        classification="owner",
        confidence=85,
        classification_reasons=["direct_owner"],
        classification_method="heuristic",
    )
    db_session.add_all([p1, p2, p3])
    db_session.commit()

    # 1. List scans
    res_list = authenticated_client.get("/admin/prospects/scans")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] == 1
    item = list_data["items"][0]
    assert item["id"] == str(job_id)
    assert item["keyword"] == "Colombo 03"
    assert item["new_count"] == 10
    assert item["filtered_count"] == 5
    assert item["duration_seconds"] == 12.4

    # 2. Get scan detail
    res_detail = authenticated_client.get(f"/admin/prospects/scans/{job_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == str(job_id)
    assert detail["status"] == "completed"
    assert detail["pages_scanned"] == 4

    # 3. Get scan prospects (only linked to this scan job)
    res_prospects = authenticated_client.get(f"/admin/prospects/scans/{job_id}/prospects")
    assert res_prospects.status_code == 200
    prospects_data = res_prospects.json()
    assert prospects_data["total"] == 2
    titles = [p["title"] for p in prospects_data["items"]]
    assert "Luxury Apartment Colombo 3" in titles
    assert "Sea View Flat Kollupitiya" in titles
    assert "Unrelated Land Kandy" not in titles

    # 4. Export CSV
    res_csv = authenticated_client.get(f"/admin/prospects/scans/{job_id}/export")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment" in res_csv.headers["content-disposition"]
    csv_text = res_csv.text
    assert "Luxury Apartment Colombo 3" in csv_text
    assert "Sea View Flat Kollupitiya" in csv_text
    assert "Unrelated Land Kandy" not in csv_text
    assert "Rs 45,000,000" in csv_text

    # 5. Start scoped phone fetch for this scan
    with patch("app.api.prospects._run_phone_fetch_job"):
        res_phone = authenticated_client.post(f"/admin/prospects/scans/{job_id}/fetch-phones")
        assert res_phone.status_code == 200
        phone_job_id = res_phone.json()["job_id"]
        assert phone_job_id is not None

        # Verify job was created in DB with keyword/category inherited
        phone_job = db_session.get(ScanJob, uuid.UUID(phone_job_id))
        assert phone_job is not None
        assert phone_job.job_type == "phone_fetch"
        assert phone_job.keyword == "Colombo 03"


def test_discarded_prospect_restore_lifecycle(authenticated_client: TestClient, db_session: Session) -> None:
    job_id = uuid.uuid4()
    job = ScanJob(
        id=job_id,
        job_type="scan",
        status="completed",
        progress="Done",
        keyword="Colombo 03",
        pages_scanned=1,
        total_pages=1,
        total_found=10,
        new_count=2,
        filtered_count=8,
    )
    p_discarded = Prospect(
        ikman_ad_id="ad-discard-1",
        ikman_url="https://ikman.lk/en/ad/ad-discard-1",
        ikman_slug="ad-discard-1",
        title="Land in Gampaha (Tag: Colombo)",
        price="Rs 5,000,000",
        location="Gampaha",
        suburb=None,
        property_type="land",
        listing_type="sale",
        classification="owner",
        confidence=90,
        classification_reasons=["owner"],
        classification_method="heuristic",
        status="discarded",
        discard_reason="location_mismatch",
        first_scan_job_id=job_id,
    )
    db_session.add_all([job, p_discarded])
    db_session.commit()

    # 1. Main prospects list should exclude discarded by default
    res_main = authenticated_client.get("/admin/prospects")
    assert res_main.status_code == 200
    assert res_main.json()["total"] == 0

    # 2. Main prospects list with status=discarded includes it
    res_discards = authenticated_client.get("/admin/prospects?status=discarded")
    assert res_discards.status_code == 200
    assert res_discards.json()["total"] == 1

    # 3. Scan job prospects includes it and shows discard_reason
    res_scan_prospects = authenticated_client.get(f"/admin/prospects/scans/{job_id}/prospects")
    assert res_scan_prospects.status_code == 200
    item = res_scan_prospects.json()["items"][0]
    assert item["status"] == "discarded"
    assert item["discard_reason"] == "location_mismatch"

    # 4. Change status from "discarded" to "new" (restore)
    res_update = authenticated_client.patch(
        f"/admin/prospects/{p_discarded.id}",
        json={"status": "new"}
    )
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["status"] == "new"
    assert updated_data["discard_reason"] is None

    # Verify ScanJob counts were updated (new_count + 1, filtered_count - 1)
    db_session.refresh(job)
    assert job.new_count == 3
    assert job.filtered_count == 7

