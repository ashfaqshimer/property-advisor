"""Tests for field assignment 10:00 AM next-day reminders."""

from datetime import datetime, timezone, timedelta
import uuid
from unittest.mock import patch
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.services.telegram_dispatch import (
    calculate_next_reminder_time,
    format_reminder_message,
    process_due_reminders,
)


def test_calculate_next_reminder_time():
    colombo_tz = ZoneInfo("Asia/Colombo")
    # Base: Monday 2026-10-05 15:30 Colombo time (10:00 UTC)
    base_dt = datetime(2026, 10, 5, 10, 0, 0, tzinfo=timezone.utc)
    target_dt = calculate_next_reminder_time(base_dt, target_hour=10, target_minute=0)

    # Next day: Tuesday 2026-10-06 at 10:00 AM Colombo time
    target_colombo = target_dt.astimezone(colombo_tz)
    assert target_colombo.year == 2026
    assert target_colombo.month == 10
    assert target_colombo.day == 6
    assert target_colombo.hour == 10
    assert target_colombo.minute == 0

    # In UTC, 10:00 Colombo (UTC+5:30) is 04:30 UTC
    assert target_dt.hour == 4
    assert target_dt.minute == 30


def test_telegram_callback_schedules_reminder_on_no_answer(
    client: TestClient,
    seeded: Session,
):
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        status="pending",
        attempt_count=1,
    )
    seeded.add(assignment)
    seeded.commit()

    callback_payload = {
        "update_id": 1001,
        "callback_query": {
            "id": "cq_123",
            "from": {"id": 99999, "first_name": "TestAgent"},
            "message": {
                "message_id": 555,
                "chat": {"id": 99999},
            },
            "data": f"fa:{assignment.id}:no_answer",
        },
    }

    with (
        patch("app.api.telegram._is_authorized_chat", return_value=True),
        patch("app.api.telegram.answer_callback_query") as mock_answer,
        patch("app.api.telegram.send_confirmation") as mock_confirm,
    ):
        res = client.post("/telegram/webhook", json=callback_payload)
        assert res.status_code == 200

        seeded.refresh(assignment)
        assert assignment.status == "no_answer"
        assert assignment.remind_at is not None
        assert assignment.reminder_sent_at is None
        mock_answer.assert_called_once()
        mock_confirm.assert_called_once()
        assert mock_confirm.call_args[0][2] == "no_answer"


def test_telegram_callback_clears_reminder_on_other_status(
    client: TestClient,
    seeded: Session,
):
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        status="no_answer",
        remind_at=datetime.now(timezone.utc) + timedelta(days=1),
        attempt_count=1,
    )
    seeded.add(assignment)
    seeded.commit()

    callback_payload = {
        "update_id": 1002,
        "callback_query": {
            "id": "cq_124",
            "from": {"id": 99999, "first_name": "TestAgent"},
            "message": {
                "message_id": 556,
                "chat": {"id": 99999},
            },
            "data": f"fa:{assignment.id}:contacted",
        },
    }

    with (
        patch("app.api.telegram._is_authorized_chat", return_value=True),
        patch("app.api.telegram.answer_callback_query"),
        patch("app.api.telegram.send_confirmation"),
    ):
        res = client.post("/telegram/webhook", json=callback_payload)
        assert res.status_code == 200

        seeded.refresh(assignment)
        assert assignment.status == "contacted"
        assert assignment.remind_at is None


def test_telegram_callback_legacy_interested_converts_to_contacted(
    seeded: Session,
    client: TestClient,
):
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        status="pending",
        remind_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    seeded.add(assignment)
    seeded.commit()

    callback_payload = {
        "update_id": 991,
        "callback_query": {
            "id": "cq_legacy_1",
            "from": {"id": 99999, "first_name": "TestAgent"},
            "message": {"message_id": 557, "chat": {"id": 99999}},
            "data": f"fa:{assignment.id}:interested",
        },
    }

    with (
        patch("app.api.telegram._is_authorized_chat", return_value=True),
        patch("app.api.telegram.answer_callback_query"),
        patch("app.api.telegram.send_confirmation"),
    ):
        res = client.post("/telegram/webhook", json=callback_payload)
        assert res.status_code == 200

        seeded.refresh(assignment)
        assert assignment.status == "contacted"



def test_process_due_reminders_sends_telegram_and_updates_db(
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="lpw",
        title="Spacious Colombo 7 House",
        price="Rs 120,000,000",
        location="Colombo 07",
        property_type="house",
        listing_type="for_sale",
        poster_name="Samantha",
        phone_number="0771234567",
        classification="owner",
        confidence=85,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.flush()

    past_time = datetime.now(timezone.utc) - timedelta(hours=1)
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="no_answer",
        remind_at=past_time,
        attempt_count=1,
        telegram_message_id=111,
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.services.telegram_dispatch.send_reminder_message", return_value=9999) as mock_send:
        processed = process_due_reminders(seeded)
        assert str(assignment.id) in processed

        seeded.refresh(assignment)
        assert assignment.attempt_count == 2
        assert assignment.telegram_message_id == 9999
        assert assignment.reminder_sent_at is not None
        assert assignment.remind_at is None

        mock_send.assert_called_once()
        assert mock_send.call_args.kwargs["attempt_count"] == 2
        assert mock_send.call_args.kwargs["poster_name"] == "Samantha"
        assert mock_send.call_args.kwargs["phone_number"] == "0771234567"


def test_admin_process_reminders_endpoint(
    authenticated_client: TestClient,
    seeded: Session,
):
    prospect = Prospect(
        id=uuid.uuid4(),
        source="ikman",
        title="Dehiwala Villa",
        price="Rs 45,000,000",
        location="Dehiwala",
        property_type="house",
        listing_type="for_sale",
        poster_name="Perera",
        phone_number="0779998877",
        classification="owner",
        confidence=90,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.flush()

    past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="no_answer",
        remind_at=past_time,
        attempt_count=1,
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.services.telegram_dispatch.send_reminder_message", return_value=8888) as mock_send:
        res = authenticated_client.post("/admin/field-assignments/process-reminders")
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert str(assignment.id) in data["processed"]
        assert data["count"] == 1
