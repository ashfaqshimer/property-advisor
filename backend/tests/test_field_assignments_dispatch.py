"""Tests for prospect dispatch, telegram assignment formatting, and auto contact fetch."""

import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.services.telegram_dispatch import (
    format_assignment_message,
)


def test_format_assignment_message_generic_terminology_and_confidence():
    # 1. With confidence score and generic listing_url
    msg = format_assignment_message(
        poster_name="Nimal Perera",
        phone_number="0771234567",
        title="Luxury Apartment in Colombo 3",
        location="Colombo 03",
        price="Rs 45,000,000",
        property_type="apartment",
        listing_type="for_sale",
        classification="owner",
        confidence=85,
        listing_url="https://www.lankapropertyweb.com/sale/property_details-12345.html",
        assignment_number=1,
        total_assignments=1,
    )

    assert "<b>Probably:</b> Direct Owner (85% confidence)" in msg
    assert '<a href="https://www.lankapropertyweb.com/sale/property_details-12345.html">View Listing</a>' in msg
    assert "View on ikman" not in msg

    # 2. With ikman_url fallback (should still use generic "View Listing")
    msg_ikman = format_assignment_message(
        poster_name="Kamal",
        phone_number="+94719876543",
        title="House for Sale",
        location="Dehiwala",
        price="Rs 35,000,000",
        property_type="house",
        listing_type="for_sale",
        classification="broker",
        confidence=90,
        ikman_url="https://ikman.lk/en/ad/house-for-sale-dehiwala",
        assignment_number=1,
        total_assignments=2,
    )

    assert "<b>Probably:</b> Another Agent / Broker (90% confidence)" in msg_ikman
    assert '<a href="https://ikman.lk/en/ad/house-for-sale-dehiwala">View Listing</a>' in msg_ikman
    assert "View on ikman" not in msg_ikman

    # 3. Without confidence
    msg_no_conf = format_assignment_message(
        poster_name="Sunil",
        phone_number="0773334444",
        title="Commercial Land",
        location="Rajagiriya",
        price="Rs 80,000,000",
        property_type="land",
        listing_type="for_sale",
        classification="owner",
        confidence=None,
        listing_url="https://example.com/listing",
        assignment_number=1,
        total_assignments=1,
    )

    assert "<b>Probably:</b> Direct Owner" in msg_no_conf
    assert "confidence" not in msg_no_conf
    assert '<a href="https://example.com/listing">View Listing</a>' in msg_no_conf


def test_dispatch_auto_fetches_contact_details_when_missing(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="lpw",
        source_url="https://www.lankapropertyweb.com/sale/property_details-999.html",
        title="LPW Pending Listing",
        price="Rs 50,000,000",
        location="Kollupitiya",
        property_type="apartment",
        listing_type="for_sale",
        classification="owner",
        confidence=75,
        classification_reasons=["initial"],
        classification_method="heuristic",
        status="new",
        poster_name=None,
        phone_number=None,
    )
    seeded.add(prospect)
    seeded.commit()

    async def fake_fetch(p: Prospect, db: Session, *, force: bool = False):
        p.poster_name = "Auto Fetched Owner"
        p.phone_number = "0779998888"
        db.commit()
        db.refresh(p)
        return True

    with (
        patch("app.api.field_assignments.fetch_prospect_contact_details", side_effect=fake_fetch) as mock_fetch,
        patch("app.api.field_assignments.send_assignment_message", return_value=12345) as mock_send,
    ):
        res = authenticated_client.post(
            "/admin/field-assignments",
            json={"prospect_ids": [str(prospect.id)]},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["prospect_phone_number"] == "0779998888"
        assert data[0]["prospect_poster_name"] == "Auto Fetched Owner"
        assert data[0]["telegram_message_id"] == 12345
        assert data[0]["prospect_source_url"] == "https://www.lankapropertyweb.com/sale/property_details-999.html"

        mock_fetch.assert_called_once()
        mock_send.assert_called_once()
        assert mock_send.call_args.kwargs["phone_number"] == "0779998888"
        assert mock_send.call_args.kwargs["poster_name"] == "Auto Fetched Owner"
        assert mock_send.call_args.kwargs["listing_url"] == "https://www.lankapropertyweb.com/sale/property_details-999.html"


def test_dispatch_skips_fetch_when_phone_already_present(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="ikman",
        ikman_url="https://ikman.lk/ad-existing",
        ikman_slug="ad-existing",
        title="Existing Phone Listing",
        price="Rs 20,000,000",
        location="Moratuwa",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=90,
        classification_reasons=["initial"],
        classification_method="heuristic",
        status="new",
        poster_name="Known Seller",
        phone_number="0712223333",
    )
    seeded.add(prospect)
    seeded.commit()

    with (
        patch("app.api.field_assignments.fetch_prospect_contact_details") as mock_fetch,
        patch("app.api.field_assignments.send_assignment_message", return_value=54321) as mock_send,
    ):
        res = authenticated_client.post(
            "/admin/field-assignments",
            json={"prospect_ids": [str(prospect.id)]},
        )
        assert res.status_code == 200
        mock_fetch.assert_not_called()
        mock_send.assert_called_once()
        assert mock_send.call_args.kwargs["phone_number"] == "0712223333"


def test_resend_auto_fetches_when_phone_missing(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="lpw",
        source_url="https://www.lankapropertyweb.com/sale/property_details-resend.html",
        title="Resend Listing",
        price="Rs 30,000,000",
        location="Colombo 05",
        property_type="apartment",
        listing_type="for_sale",
        classification="owner",
        confidence=80,
        classification_reasons=["initial"],
        classification_method="heuristic",
        status="new",
        poster_name=None,
        phone_number=None,
    )
    seeded.add(prospect)
    seeded.commit()

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="pending",
    )
    seeded.add(assignment)
    seeded.commit()

    async def fake_fetch(p: Prospect, db: Session, *, force: bool = False):
        p.phone_number = "0771112222"
        p.poster_name = "Resend Contact"
        db.commit()
        db.refresh(p)
        return True

    with (
        patch("app.api.field_assignments.fetch_prospect_contact_details", side_effect=fake_fetch) as mock_fetch,
        patch("app.api.field_assignments.send_assignment_message", return_value=99999) as mock_send,
    ):
        res = authenticated_client.post(f"/admin/field-assignments/{assignment.id}/resend")
        assert res.status_code == 200
        mock_fetch.assert_called_once()
        assert mock_send.call_args.kwargs["phone_number"] == "0771112222"
        assert mock_send.call_args.kwargs["poster_name"] == "Resend Contact"


def test_delete_assignment_by_id(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="ikman",
        title="Delete Test Prospect",
        price="Rs 25,000,000",
        location="Rajagiriya",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=90,
        classification_reasons=["initial"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.commit()

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="pending",
        telegram_message_id=888123,
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.api.field_assignments.delete_assignment_message", return_value=True) as mock_del_tg:
        res = authenticated_client.delete(f"/admin/field-assignments/{assignment.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["id"] == str(assignment.id)
        mock_del_tg.assert_called_once_with(888123)

    # Verify deleted from DB
    assert seeded.get(FieldAssignment, assignment.id) is None


def test_delete_assignment_by_prospect(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="ikman",
        title="Delete By Prospect Test",
        price="Rs 30,000,000",
        location="Battaramulla",
        property_type="land",
        listing_type="for_sale",
        classification="owner",
        confidence=85,
        classification_reasons=["initial"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.commit()

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="pending",
        telegram_message_id=777456,
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.api.field_assignments.delete_assignment_message", return_value=True) as mock_del_tg:
        res = authenticated_client.delete(f"/admin/field-assignments/by-prospect/{prospect.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["id"] == str(assignment.id)
        mock_del_tg.assert_called_once_with(777456)

    # Verify deleted from DB
    assert seeded.get(FieldAssignment, assignment.id) is None


def test_build_classification_keyboard():
    from app.services.telegram_dispatch import build_classification_keyboard

    kb = build_classification_keyboard("test-assignment-id")
    buttons = kb["inline_keyboard"]
    assert len(buttons) == 2
    row1 = buttons[0]
    row2 = buttons[1]

    assert row1[0]["text"] == "👤 Direct Owner"
    assert row1[0]["callback_data"] == "fac:test-assignment-id:owner"
    assert row1[1]["text"] == "🏢 Agent / Broker"
    assert row1[1]["callback_data"] == "fac:test-assignment-id:broker"

    assert row2[0]["text"] == "⏩ Skip / Unsure"
    assert row2[0]["callback_data"] == "fac:test-assignment-id:skip"


def test_format_assignment_message_status_and_verified():
    from app.services.telegram_dispatch import format_assignment_message

    msg = format_assignment_message(
        poster_name="Sunil Perera",
        phone_number="0771234567",
        title="House in Thalawathugoda",
        location="Thalawathugoda",
        price="Rs 40,000,000",
        property_type="house",
        listing_type="for_sale",
        classification="broker",
        confidence=60,
        status="contacted",
        handled_by="Agent John",
        verified_classification="owner",
    )

    assert "📋 <b>Prospect • ✅ Contacted</b>" in msg
    assert "💡 <b>Contact Type:</b> Direct Owner <i>(Agent verified)</i>" in msg
    assert "✍️ <b>Updated by:</b> Agent John" in msg


def test_format_reminder_message_status_and_verified():
    from app.services.telegram_dispatch import format_reminder_message

    msg = format_reminder_message(
        poster_name="Kamal",
        phone_number="0779998888",
        title="Apartment in Colombo 7",
        location="Colombo 07",
        price="Rs 80,000,000",
        property_type="apartment",
        listing_type="for_sale",
        attempt_count=2,
        status="no_answer",
        handled_by="Agent Sarah",
    )

    assert "⏰ <b>Follow-up Reminder • 📵 No Answer</b>" in msg
    assert "✍️ <b>Updated by:</b> Agent Sarah" in msg


def test_update_assignment_status_and_notes(authenticated_client: TestClient, seeded: Session):
    from app.models.scan_job import ScanJob

    job = ScanJob(
        id=uuid.uuid4(),
        source="ikman",
        job_type="manual",
        status="completed",
        progress="done",
        new_count=5,
        filtered_count=2,
    )
    seeded.add(job)

    prospect = Prospect(
        id=uuid.uuid4(),
        source="ikman",
        source_id="p-123",
        title="House in Maharagama",
        price="Rs 25,000,000",
        location="Maharagama",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=90,
        classification_reasons=["owner"],
        classification_method="heuristic",
        status="contacted",
        first_scan_job_id=job.id,
    )
    seeded.add(prospect)

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="contacted",
        telegram_message_id=777,
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.api.field_assignments.sync_telegram_assignment_card") as mock_sync_card:
        # 1. Update status to not_interested -> cascades prospect to discarded and updates scan job
        res = authenticated_client.patch(
            f"/admin/field-assignments/{assignment.id}",
            json={"status": "not_interested", "notes": "Owner already sold last week"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "not_interested"
        assert data["notes"] == "Owner already sold last week"

        seeded.refresh(prospect)
        seeded.refresh(job)
        seeded.refresh(assignment)
        assert prospect.status == "discarded"
        assert prospect.discard_reason == "not_interested"
        assert job.new_count == 4
        assert job.filtered_count == 3
        mock_sync_card.assert_called_once()

    with patch("app.api.field_assignments.sync_telegram_assignment_card"):
        # 2. Correct mistake: Admin updates status to no_answer -> clears discard, sets remind_at
        res2 = authenticated_client.patch(
            f"/admin/field-assignments/{assignment.id}",
            json={"status": "no_answer"},
        )
        assert res2.status_code == 200
        seeded.refresh(prospect)
        seeded.refresh(job)
        seeded.refresh(assignment)
        assert assignment.status == "no_answer"
        assert assignment.remind_at is not None
        assert prospect.status == "new"
        assert prospect.discard_reason is None
        assert job.new_count == 5
        assert job.filtered_count == 2

