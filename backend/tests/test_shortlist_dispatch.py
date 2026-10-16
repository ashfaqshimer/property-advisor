import uuid
from unittest.mock import patch, MagicMock

import pytest
from app.models.prospect import Prospect
from app.models.scan_job import ScanJob
from app.services.telegram_dispatch import (
    _build_shortlist_keyboard,
    build_shortlist_collapsed_keyboard,
    format_shortlist_message,
    format_shortlist_collapsed_message,
    send_shortlist_message,
    delete_telegram_message,
)


def test_telegram_shortlist_formatting():
    msg = format_shortlist_message(
        poster_name="Kamal Perera",
        phone_number="0771234567",
        title="Modern Luxury Villa in Colombo 7",
        location="Colombo 7",
        price="Rs 120,000,000",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=95,
        ikman_url="https://ikman.lk/ad/test-1",
    )
    assert "⭐ <b>Review for Shortlist</b>" in msg
    assert "Kamal Perera" in msg
    assert "+94 771234567" in msg
    assert "Modern Luxury Villa in Colombo 7" in msg
    assert "Direct Owner" in msg
    assert "95% confidence" in msg
    assert "https://ikman.lk/ad/test-1" in msg

    kb = _build_shortlist_keyboard("abc-123")
    assert len(kb["inline_keyboard"]) == 1
    assert kb["inline_keyboard"][0][0]["callback_data"] == "sl:abc-123:keep"
    assert kb["inline_keyboard"][0][1]["callback_data"] == "sl:abc-123:pass"

    kb_with_phone = _build_shortlist_keyboard("abc-123", "0771234567")
    assert len(kb_with_phone["inline_keyboard"]) == 2
    assert kb_with_phone["inline_keyboard"][1][0]["text"] == "💬 WhatsApp"
    assert "https://wa.me/94771234567" in kb_with_phone["inline_keyboard"][1][0]["url"]
    assert kb_with_phone["inline_keyboard"][1][1]["text"] == "📞 Call"
    assert "/telegram/call/94771234567" in kb_with_phone["inline_keyboard"][1][1]["url"]

    collapsed = format_shortlist_collapsed_message(
        poster_name="Kamal Perera",
        phone_number="0771234567",
        title="Modern Luxury Villa",
        location="Colombo 7",
        price="Rs 120,000,000",
        ikman_url="https://ikman.lk/ad/test-1",
        handled_by="Shime",
    )
    assert "⭐ <b>Shortlisted by Shime</b>" in collapsed
    assert "Modern Luxury Villa" in collapsed

    collapsed_kb = build_shortlist_collapsed_keyboard("abc-123", "0771234567")
    contact_buttons = collapsed_kb["inline_keyboard"][0]
    assert contact_buttons[0]["text"] == "💬 WhatsApp"
    assert "https://wa.me/94771234567" in contact_buttons[0]["url"]
    assert contact_buttons[1]["text"] == "📞 Call"
    assert "/telegram/call/94771234567" in contact_buttons[1]["url"]
    assert collapsed_kb["inline_keyboard"][1][0]["callback_data"] == "sl:abc-123:undo"


def test_send_shortlist_message_with_topic():
    with patch("app.services.telegram_dispatch.get_settings") as mock_settings, \
         patch("httpx.Client.post") as mock_post:
        mock_settings.return_value.telegram_bot_token = "123:TOKEN"
        mock_settings.return_value.telegram_shortlist_chat_id = "-100123456789"
        mock_settings.return_value.telegram_shortlist_thread_id = 42
        mock_settings.return_value.telegram_assignments_chat_id = ""
        mock_settings.return_value.telegram_chat_id = ""

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 9991}}
        mock_post.return_value = mock_resp

        msg_id = send_shortlist_message(
            prospect_id="uuid-1",
            poster_name="Saman",
            phone_number="0712345678",
            title="House in Nugegoda",
            location="Nugegoda",
            price="Rs 45,000,000",
            property_type="house",
            listing_type="for_sale",
            classification="owner",
            confidence=85,
        )

        assert msg_id == 9991
        mock_post.assert_called_once()
        sent_payload = mock_post.call_args[1]["json"]
        assert sent_payload["chat_id"] == "-100123456789"
        assert sent_payload["message_thread_id"] == 42
        assert sent_payload["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == "sl:uuid-1:keep"


def test_send_shortlist_message_uses_telegram_chat_id_and_ignores_assignments_chat_id():
    """Verify that when shortlist chat_id is omitted, it sends to TELEGRAM_CHAT_ID, NOT assignments_chat_id."""
    with patch("app.services.telegram_dispatch.get_settings") as mock_settings, \
         patch("httpx.Client.post") as mock_post:
        mock_settings.return_value.telegram_bot_token = "123:TOKEN"
        mock_settings.return_value.telegram_shortlist_chat_id = ""
        mock_settings.return_value.telegram_shortlist_group_id = ""
        mock_settings.return_value.telegram_shortlist_thread_id = 99
        mock_settings.return_value.telegram_assignments_chat_id = "-100999999"  # agents chat group
        mock_settings.return_value.telegram_chat_id = "-100111111"  # main telegram chat

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 888}}
        mock_post.return_value = mock_resp

        msg_id = send_shortlist_message(
            prospect_id="uuid-main",
            poster_name="Owner",
            phone_number="0771112233",
            title="Apartment in Colombo",
            location="Colombo",
            price="Rs 35,000,000",
            property_type="apartment",
            listing_type="for_sale",
            classification="owner",
            confidence=95,
        )

        assert msg_id == 888
        mock_post.assert_called_once()
        sent_payload = mock_post.call_args[1]["json"]
        # Must send to TELEGRAM_CHAT_ID (-100111111) with thread_id 99, NOT assignments (-100999999)
        assert sent_payload["chat_id"] == "-100111111"
        assert sent_payload["message_thread_id"] == 99


def test_delete_telegram_message():
    with patch("httpx.Client.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"ok": True, "result": True}
        mock_post.return_value = mock_resp

        success = delete_telegram_message("123:TOKEN", "-100123456789", 555)
        assert success is True
        sent_payload = mock_post.call_args[1]["json"]
        assert sent_payload["chat_id"] == "-100123456789"
        assert sent_payload["message_id"] == 555


def test_telegram_webhook_shortlist_keep(seeded, client):
    prospect = Prospect(
        id=uuid.uuid4(),
        title="Test Shortlist Penthouse",
        price="Rs 85,000,000",
        location="Colombo 3",
        property_type="apartment",
        listing_type="for_sale",
        poster_name="Nimal",
        phone_number="0779876543",
        classification="owner",
        confidence=90,
        classification_reasons=["owner_keyword"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.commit()

    with (
        patch("app.api.telegram.answer_callback_query") as mock_answer,
        patch("app.api.telegram.edit_telegram_message") as mock_edit_msg,
        patch("app.api.telegram.get_settings") as mock_settings,
    ):
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_shortlist_chat_id = "-100888"
        mock_settings.return_value.telegram_shortlist_thread_id = 15
        mock_settings.return_value.telegram_assignments_chat_id = ""
        mock_settings.return_value.telegram_agent_chat_id = ""
        mock_settings.return_value.telegram_chat_id = ""
        mock_settings.return_value.telegram_webhook_secret = ""

        resp = client.post(
            "/telegram/webhook",
            json={
                "update_id": 101,
                "callback_query": {
                    "id": "cq-sl-1",
                    "from": {"id": 123456, "first_name": "AdminShime"},
                    "message": {
                        "message_id": 7788,
                        "chat": {"id": -100888, "type": "supergroup"},
                        "message_thread_id": 15,
                    },
                    "data": f"sl:{prospect.id}:keep",
                },
            },
        )
        assert resp.status_code == 200

        seeded.refresh(prospect)
        assert prospect.status == "shortlisted"
        mock_edit_msg.assert_called_once()
        mock_answer.assert_called_once_with("123:ABC", "cq-sl-1", "⭐ Saved to Shortlist!")


def test_telegram_webhook_shortlist_pass(seeded, client):
    scan_job = ScanJob(job_type="scan", status="completed", new_count=5, filtered_count=2, progress="Done")
    seeded.add(scan_job)
    seeded.flush()

    prospect = Prospect(
        id=uuid.uuid4(),
        title="Test Pass Villa",
        price="Rs 40,000,000",
        location="Malabe",
        property_type="house",
        listing_type="for_sale",
        poster_name="Sunil",
        phone_number="0771122334",
        classification="owner",
        confidence=80,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="new",
        first_scan_job_id=scan_job.id,
    )
    seeded.add(prospect)
    seeded.commit()

    with (
        patch("app.api.telegram.answer_callback_query") as mock_answer,
        patch("app.api.telegram.delete_telegram_message") as mock_delete_msg,
        patch("app.api.telegram.get_settings") as mock_settings,
    ):
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_shortlist_chat_id = "-100888"
        mock_settings.return_value.telegram_shortlist_thread_id = 15
        mock_settings.return_value.telegram_assignments_chat_id = ""
        mock_settings.return_value.telegram_agent_chat_id = ""
        mock_settings.return_value.telegram_chat_id = ""
        mock_settings.return_value.telegram_webhook_secret = ""

        resp = client.post(
            "/telegram/webhook",
            json={
                "update_id": 102,
                "callback_query": {
                    "id": "cq-sl-2",
                    "from": {"id": 123456, "first_name": "AdminShime"},
                    "message": {
                        "message_id": 7789,
                        "chat": {"id": -100888, "type": "supergroup"},
                        "message_thread_id": 15,
                    },
                    "data": f"sl:{prospect.id}:pass",
                },
            },
        )
        assert resp.status_code == 200

        seeded.refresh(prospect)
        assert prospect.status == "discarded"
        assert prospect.discard_reason == "not_interested"

        seeded.refresh(scan_job)
        assert scan_job.new_count == 4
        assert scan_job.filtered_count == 3

        mock_delete_msg.assert_called_once_with("123:ABC", "-100888", 7789)
        mock_answer.assert_called_once_with("123:ABC", "cq-sl-2", "❌ Removed.")


def test_telegram_webhook_shortlist_undo(seeded, client):
    prospect = Prospect(
        id=uuid.uuid4(),
        title="Test Undo Property",
        price="Rs 50,000,000",
        location="Battaramulla",
        property_type="house",
        listing_type="for_sale",
        poster_name="Kasun",
        phone_number="0773344556",
        classification="owner",
        confidence=85,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="discarded",
        discard_reason="not_interested",
    )
    seeded.add(prospect)
    seeded.commit()

    with (
        patch("app.api.telegram.answer_callback_query") as mock_answer,
        patch("app.api.telegram.edit_telegram_message") as mock_edit_msg,
        patch("app.api.telegram.get_settings") as mock_settings,
    ):
        mock_settings.return_value.telegram_bot_token = "123:ABC"
        mock_settings.return_value.telegram_shortlist_chat_id = "-100888"
        mock_settings.return_value.telegram_shortlist_thread_id = 15
        mock_settings.return_value.telegram_assignments_chat_id = ""
        mock_settings.return_value.telegram_agent_chat_id = ""
        mock_settings.return_value.telegram_chat_id = ""
        mock_settings.return_value.telegram_webhook_secret = ""

        resp = client.post(
            "/telegram/webhook",
            json={
                "update_id": 103,
                "callback_query": {
                    "id": "cq-sl-3",
                    "from": {"id": 123456, "first_name": "AdminShime"},
                    "message": {
                        "message_id": 7790,
                        "chat": {"id": -100888, "type": "supergroup"},
                        "message_thread_id": 15,
                    },
                    "data": f"sl:{prospect.id}:undo",
                },
            },
        )
        assert resp.status_code == 200

        seeded.refresh(prospect)
        assert prospect.status == "new"
        assert prospect.discard_reason is None
        mock_edit_msg.assert_called_once()
        mock_answer.assert_called_once_with("123:ABC", "cq-sl-3", "↩️ Restored to queue.")


def test_admin_shortlist_dispatch_endpoint(seeded, authenticated_client):
    prospect = Prospect(
        id=uuid.uuid4(),
        title="Dispatch Test Property",
        price="Rs 60,000,000",
        location="Colombo 5",
        property_type="house",
        listing_type="for_sale",
        poster_name="Perera",
        phone_number="0779988776",
        classification="owner",
        confidence=90,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="new",
    )
    seeded.add(prospect)
    seeded.commit()

    with patch("app.api.prospects.send_shortlist_message", return_value=1234) as mock_send, \
         patch("app.api.prospects.get_settings") as mock_settings:
        mock_settings.return_value.telegram_shortlist_configured = True

        resp = authenticated_client.post(
            "/admin/prospects/shortlist-dispatch",
            json={"prospect_ids": [str(prospect.id)]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["dispatched"] == 1
        assert data["failed"] == 0
        assert data["total"] == 1
        mock_send.assert_called_once()


def test_admin_metrics_shortlisted_count(seeded, authenticated_client):
    prospect = Prospect(
        id=uuid.uuid4(),
        title="Metrics Test Property",
        price="Rs 70,000,000",
        location="Colombo 4",
        property_type="apartment",
        listing_type="for_sale",
        poster_name="Silva",
        phone_number="0775566778",
        classification="owner",
        confidence=92,
        classification_reasons=["heuristic"],
        classification_method="heuristic",
        status="shortlisted",
    )
    seeded.add(prospect)
    seeded.commit()

    resp = authenticated_client.get("/admin/prospects/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "shortlisted_count" in data
    assert data["shortlisted_count"] >= 1


def test_call_redirect_endpoint(authenticated_client):
    resp = authenticated_client.get("/telegram/call/94771234567")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    assert "tel:+94771234567" in resp.text
    assert "Calling +94771234567" in resp.text
