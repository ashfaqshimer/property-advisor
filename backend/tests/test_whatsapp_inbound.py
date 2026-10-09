"""Tests for WhatsApp inbound channel and webhook endpoints."""

import hashlib
import hmac
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lead import Lead, LeadIntent
from app.models.prospect import Prospect
from app.schemas.extractor import ExtractedPropertyDraft
from app.services.whatsapp_client import WhatsAppClient
from app.services.whatsapp_inbound import process_inbound_whatsapp_message


def test_whatsapp_client_unconfigured(monkeypatch):
    """WhatsApp client gracefully logs and exits if tokens are missing."""
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "")
    client = WhatsAppClient()
    assert not client.is_configured
    result = client.send_text_message("0771234567", "Hello")
    assert result is None


def test_whatsapp_client_send_message_success():
    """WhatsApp client sends POST request to Graph API when configured."""
    client = WhatsAppClient(access_token="test_token", phone_number_id="123456789")
    assert client.is_configured

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"messages": [{"id": "wamid.HBgL..."}]}

    with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
        res = client.send_text_message("0771234567", "Listing confirmed")
        assert res is not None
        assert mock_post.called
        call_args, call_kwargs = mock_post.call_args
        assert "123456789/messages" in call_args[0]
        assert call_kwargs["json"]["to"] == "0771234567"


def test_whatsapp_webhook_verification_handshake(client: TestClient, monkeypatch):
    """Meta webhook GET handshake verifies challenge and token."""
    monkeypatch.setattr("app.api.whatsapp.get_settings", lambda: MagicMock(
        whatsapp_verify_token="my_secret_token",
        whatsapp_app_secret="",
    ))

    # Correct verify token
    res = client.get(
        "/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "my_secret_token",
            "hub.challenge": "1122334455",
        },
    )
    assert res.status_code == 200
    assert res.text == "1122334455"

    # Incorrect verify token -> 403
    res_bad = client.get(
        "/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "1122334455",
        },
    )
    assert res_bad.status_code == 403


def test_whatsapp_webhook_signature_verification(client: TestClient, monkeypatch):
    """POST /whatsapp/webhook rejects invalid HMAC-SHA256 signatures when secret is configured."""
    secret = "app_secret_123"
    monkeypatch.setattr("app.api.whatsapp.get_settings", lambda: MagicMock(
        whatsapp_app_secret=secret,
        whatsapp_verify_token="token",
    ))

    payload = b'{"entry": []}'
    correct_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    # Valid signature
    res = client.post(
        "/whatsapp/webhook",
        content=payload,
        headers={"Content-Type": "application/json", "x-hub-signature-256": correct_sig},
    )
    assert res.status_code == 200

    # Bad signature
    res_bad = client.post(
        "/whatsapp/webhook",
        content=payload,
        headers={"Content-Type": "application/json", "x-hub-signature-256": "sha256=invalid"},
    )
    assert res_bad.status_code == 403


def test_process_inbound_whatsapp_message_success(db_session: Session):
    """Valid real estate message creates a Prospect, Lead, and triggers alert/reply."""
    sample_text = (
        "Dehiwala 3 bedroom house for sale on Station Road. "
        "Land 10 perches, 2 bathrooms, 35M negotiable. Call Kamal 0771234567"
    )

    fake_draft = ExtractedPropertyDraft(
        title="3-Bedroom House in Dehiwala",
        description="Spacious 3 bedroom house situated along Station Road, Dehiwala.",
        location="Dehiwala",
        price=Decimal("35000000.0"),
        is_price_per_perch=False,
        land_size_perches=Decimal("10.0"),
        bedrooms=3,
        bathrooms=2,
        property_type="house",
        listing_type="sale",
        contact_name="Kamal",
        contact_phone="0771234567",
        contact_type="owner",
    )

    mock_client = MagicMock()

    with patch("app.services.whatsapp_inbound.extract_property_details", return_value=fake_draft), \
         patch("app.services.whatsapp_inbound.send_lead_alert") as mock_alert:
        result = process_inbound_whatsapp_message(
            db=db_session,
            sender_phone="94771234567",
            message_text=sample_text,
            message_id="msg_test_001",
            whatsapp_client=mock_client,
        )

        assert result["status"] == "success"
        assert result["title"] == "3-Bedroom House in Dehiwala"

        # Verify Prospect in DB
        prospect = db_session.execute(
            select(Prospect).where(Prospect.source == "whatsapp", Prospect.source_id == "wa_msg_test_001")
        ).scalar_one_or_none()
        assert prospect is not None
        assert prospect.location == "Dehiwala"
        assert prospect.bedrooms == 3
        assert prospect.price_numeric == Decimal("35000000.0")
        assert prospect.phone_number == "0771234567"
        assert prospect.classification == "owner"

        # Verify Lead in DB
        lead = db_session.execute(
            select(Lead).where(Lead.phone == "0771234567")
        ).scalar_one_or_none()
        assert lead is not None
        assert lead.name == "Kamal"
        assert lead.intent == LeadIntent.SELL
        assert lead.budget_min == Decimal("35000000.0")

        # Verify Telegram alert was triggered
        assert mock_alert.called

        # Verify WhatsApp auto-reply was dispatched
        assert mock_client.send_text_message.called


def test_process_inbound_whatsapp_duplicate_message_idempotent(db_session: Session):
    """Duplicate message IDs are not ingested twice."""
    fake_draft = ExtractedPropertyDraft(
        title="Apartment in Colombo 3",
        location="Colombo 3",
        price=Decimal("45000000.0"),
        property_type="apartment",
        listing_type="sale",
    )

    with patch("app.services.whatsapp_inbound.extract_property_details", return_value=fake_draft), \
         patch("app.services.whatsapp_inbound.send_lead_alert"):
        # First execution
        res1 = process_inbound_whatsapp_message(
            db=db_session,
            sender_phone="94779998888",
            message_text="Luxury 2-bed apartment for sale in Colombo 3",
            message_id="dup_msg_999",
        )
        assert res1["status"] == "success"

        # Second execution with same message ID
        res2 = process_inbound_whatsapp_message(
            db=db_session,
            sender_phone="94779998888",
            message_text="Luxury 2-bed apartment for sale in Colombo 3",
            message_id="dup_msg_999",
        )
        assert res2["status"] == "already_processed"


def test_process_inbound_whatsapp_unrecognized_text(db_session: Session):
    """Casual or non-listing text sends helpful onboarding prompt without creating DB records."""
    mock_client = MagicMock()

    with patch("app.services.whatsapp_inbound.extract_property_details", return_value=None):
        res = process_inbound_whatsapp_message(
            db=db_session,
            sender_phone="94771112222",
            message_text="Hi Amaya, good morning!",
            message_id="casual_01",
            whatsapp_client=mock_client,
        )

        assert res["status"] == "unrecognized_or_greeting"
        assert mock_client.send_text_message.called
        call_msg = mock_client.send_text_message.call_args[1]["message"]
        assert "Property Advisor Sri Lanka" in call_msg
