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
