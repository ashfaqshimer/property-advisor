"""Tests for the Telegram notification service."""

from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.notifications import (
    build_inline_keyboard,
    clean_phone_digits,
    format_budget,
    format_lead_message,
    send_lead_alert,
    send_telegram_notification,
    to_whatsapp_number,
)


def test_clean_phone_digits():
    assert clean_phone_digits("+94 (77) 123-4567") == "94771234567"
    assert clean_phone_digits("077 123 4567") == "0771234567"
    assert clean_phone_digits(None) == ""


def test_to_whatsapp_number():
    # Sri Lankan 10-digit standard converts leading 0 to 94
    assert to_whatsapp_number("0771234567") == "94771234567"
    assert to_whatsapp_number("+94771234567") == "94771234567"
    assert to_whatsapp_number("0112345678") == "94112345678"
    # International number preserved
    assert to_whatsapp_number("+447911123456") == "447911123456"
    assert to_whatsapp_number(None) is None


def test_format_budget():
    assert format_budget(Decimal("25000000"), Decimal("40000000")) == "LKR 25,000,000 – LKR 40,000,000"
    assert format_budget(Decimal("15000000"), None) == "From LKR 15,000,000"
    assert format_budget(None, Decimal("50000000")) == "Up to LKR 50,000,000"
    assert format_budget(None, None) is None


def test_format_lead_message_escaping():
    msg = format_lead_message(
        name="John <Doe> & Co",
        phone="0771234567",
        intent="buy",
        interest="apartment_sale",
        budget_min=Decimal("30000000"),
        requirements="Looking for 2BR < 1000 sqft",
        remarks="Needs immediate > 1 month lease",
        source="ai_agent",
    )
    assert "&lt;Doe&gt; &amp; Co" in msg
    assert "<code>0771234567</code>" in msg
    assert "Buy (Apartment Sale)" in msg
    assert "LKR 30,000,000" in msg
    assert "&lt; 1000 sqft" in msg
    assert "&gt; 1 month" in msg
    assert "Ai Agent" in msg


def test_build_inline_keyboard():
    markup = build_inline_keyboard("0771234567")
    assert markup is not None
    buttons = markup["inline_keyboard"][0]
    assert len(buttons) == 1
    assert buttons[0]["text"] == "💬 WhatsApp Lead"
    assert buttons[0]["url"] == "https://wa.me/94771234567"

    assert build_inline_keyboard(None) is None


def test_send_telegram_notification_unconfigured():
    with patch("app.services.notifications.get_settings") as mock_settings:
        mock_settings.return_value.telegram_bot_token = ""
        mock_settings.return_value.telegram_chat_id = ""
        result = send_telegram_notification("Test", sync=True)
        assert result is False


def test_send_telegram_notification_success():
    with patch("app.services.notifications.get_settings") as mock_settings, patch(
        "httpx.Client.post"
    ) as mock_post:
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_chat_id = "-100123456"

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True}
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        result = send_telegram_notification("Test message", sync=True)
        assert result is True
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://api.telegram.org/bot123:ABC/sendMessage"
        assert kwargs["json"]["chat_id"] == "-100123456"
        assert kwargs["json"]["text"] == "Test message"
        assert kwargs["json"]["parse_mode"] == "HTML"


def test_send_telegram_notification_api_failure():
    with patch("app.services.notifications.get_settings") as mock_settings, patch(
        "httpx.Client.post"
    ) as mock_post:
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_chat_id = "-100123456"

        mock_post.side_effect = Exception("Network timeout")

        # Never raises, returns False gracefully
        result = send_telegram_notification("Test", sync=True)
        assert result is False


def test_send_telegram_notification_thread_routing():
    with patch("app.services.notifications.get_settings") as mock_settings, patch(
        "httpx.Client.post"
    ) as mock_post:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True}
        mock_post.return_value = mock_resp

        # 1. Supergroup (starts with -) includes thread ID
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_chat_id = "-100123456"
        send_telegram_notification("Group topic msg", thread_id=18, sync=True)
        _, kwargs = mock_post.call_args
        assert kwargs["json"]["message_thread_id"] == 18

        # 2. Private chat (positive ID) ignores thread ID to prevent Telegram 400 error
        mock_settings.return_value.telegram_chat_id = "5043469550"
        send_telegram_notification("Private DM msg", thread_id=18, sync=True)
        _, kwargs = mock_post.call_args
        assert "message_thread_id" not in kwargs["json"]


def test_send_system_alert():
    from app.services.notifications import send_system_alert

    with patch("app.services.notifications.get_settings") as mock_settings, patch(
        "httpx.Client.post"
    ) as mock_post:
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_chat_id = "-100123456"
        mock_settings.return_value.telegram_alerts_thread_id = 19
        mock_settings.return_value.app_environment = "production"

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True}
        mock_post.return_value = mock_resp

        ok = send_system_alert(
            title="Gemini Quota Exceeded",
            details="ResourceExhausted: 429 quota exceeded for gemini-3.1-flash-lite",
            level="WARNING",
            sync=True,
        )
        assert ok is True
        _, kwargs = mock_post.call_args
        payload = kwargs["json"]
        assert payload["message_thread_id"] == 19
        assert "System Alert: Gemini Quota Exceeded" in payload["text"]
        assert "ResourceExhausted: 429" in payload["text"]
        assert "[PRODUCTION]" in payload["text"]


def test_telegram_webhook_prospect_status_sync(seeded, client):
    from unittest.mock import patch
    import uuid
    from app.models.prospect import Prospect
    from app.models.scan_job import ScanJob
    from app.models.field_assignment import FieldAssignment

    scan_job = ScanJob(
        id=uuid.uuid4(),
        job_type="scan",
        status="completed",
        new_count=1,
        filtered_count=0,
    )
    seeded.add(scan_job)
    seeded.flush()

    prospect = Prospect(
        id=uuid.uuid4(),
        ikman_ad_id="ad-test-tg",
        ikman_url="https://ikman.lk/en/ad/test-tg",
        ikman_slug="test-tg",
        title="Test Property",
        price="Rs 25,000,000",
        location="Colombo 03",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=85,
        classification_reasons=["direct_owner"],
        classification_method="heuristic",
        status="new",
        first_scan_job_id=scan_job.id,
    )
    seeded.add(prospect)
    seeded.flush()

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="pending",
    )
    seeded.add(assignment)
    seeded.commit()

    with patch("app.api.telegram.answer_callback_query"), patch("app.api.telegram.send_confirmation"), patch("app.api.telegram._get_agent_chat_id", return_value="123456"):
        # Agent taps "not_interested"
        resp = client.post(
            "/telegram/webhook",
            json={
                "update_id": 1,
                "callback_query": {
                    "id": "cq-1",
                    "from": {"id": 123456},
                    "data": f"fa:{assignment.id}:not_interested",
                },
            },
        )
        assert resp.status_code == 200

        seeded.refresh(prospect)
        seeded.refresh(scan_job)
        seeded.refresh(assignment)

        assert assignment.status == "not_interested"
        assert prospect.status == "discarded"
        assert prospect.discard_reason == "not_interested"
        assert scan_job.new_count == 0
        assert scan_job.filtered_count == 1

        # Agent taps "interested" (e.g. follow-up or re-open)
        resp2 = client.post(
            "/telegram/webhook",
            json={
                "update_id": 2,
                "callback_query": {
                    "id": "cq-2",
                    "from": {"id": 123456},
                    "data": f"fa:{assignment.id}:interested",
                },
            },
        )
        assert resp2.status_code == 200

        seeded.refresh(prospect)
        seeded.refresh(scan_job)
        seeded.refresh(assignment)

        assert assignment.status == "interested"
        assert prospect.status == "contacted"
        assert prospect.discard_reason is None
        assert scan_job.new_count == 1
        assert scan_job.filtered_count == 0


def test_telegram_webhook_group_topic_sync(seeded, client):
    from unittest.mock import patch
    import uuid
    from app.models.prospect import Prospect
    from app.models.field_assignment import FieldAssignment

    prospect = Prospect(
        id=uuid.uuid4(),
        ikman_ad_id="ad-topic-tg",
        ikman_url="https://ikman.lk/en/ad/topic-tg",
        ikman_slug="topic-tg",
        title="Topic Property",
        price="Rs 30,000,000",
        location="Dehiwala",
        property_type="land",
        listing_type="for_sale",
        classification="owner",
        confidence=90,
        classification_reasons=["direct_owner"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.flush()

    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=prospect.id,
        status="pending",
    )
    seeded.add(assignment)
    seeded.commit()

    with (
        patch("app.api.telegram.answer_callback_query") as mock_answer,
        patch("app.api.telegram.send_confirmation") as mock_confirm,
        patch("app.api.telegram.get_settings") as mock_settings,
    ):
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_assignments_chat_id = "-100999"
        mock_settings.return_value.telegram_agent_chat_id = ""
        mock_settings.return_value.telegram_chat_id = ""
        mock_settings.return_value.telegram_webhook_secret = ""

        # Group member taps "interested" in a topic thread
        resp = client.post(
            "/telegram/webhook",
            json={
                "update_id": 10,
                "callback_query": {
                    "id": "cq-group-1",
                    "from": {"id": 8660126912, "first_name": "Deen"},
                    "message": {
                        "message_id": 55,
                        "message_thread_id": 42,
                        "chat": {"id": -100999, "type": "supergroup"},
                    },
                    "data": f"fa:{assignment.id}:interested",
                },
            },
        )
        assert resp.status_code == 200
        mock_answer.assert_called_once_with("123:ABC", "cq-group-1")
        mock_confirm.assert_called_once_with(
            "-100999",
            "123:ABC",
            "interested",
            user_name="Deen",
            thread_id=42,
        )

        seeded.refresh(assignment)
        assert assignment.status == "interested"
        assert assignment.awaiting_notes is True
