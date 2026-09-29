"""Lead notification service for Telegram alerts."""

import html
import re
import threading
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


def clean_phone_digits(phone: str | None) -> str:
    """Strip all non-digit characters from a phone string."""
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


def to_whatsapp_number(phone: str | None) -> str | None:
    """Format phone digits for international WhatsApp links (https://wa.me/<number>).

    For Sri Lankan local numbers (e.g. 0771234567 or 0112345678), replace the leading
    0 with country code 94.
    """
    digits = clean_phone_digits(phone)
    if not digits:
        return None
    if digits.startswith("0") and len(digits) == 10:
        return "94" + digits[1:]
    return digits


def _format_currency(val: Decimal | float | int | None) -> str | None:
    if val is None:
        return None
    return f"LKR {int(val):,}"


def format_budget(budget_min: Decimal | None, budget_max: Decimal | None) -> str | None:
    """Format budget bounds into a readable string."""
    f_min = _format_currency(budget_min)
    f_max = _format_currency(budget_max)
    if f_min and f_max:
        return f"{f_min} – {f_max}"
    if f_min:
        return f"From {f_min}"
    if f_max:
        return f"Up to {f_max}"
    return None


def format_lead_message(
    *,
    name: str | None = None,
    phone: str | None = None,
    intent: str | None = None,
    interest: str | None = None,
    budget_min: Decimal | None = None,
    budget_max: Decimal | None = None,
    requirements: str | None = None,
    remarks: str | None = None,
    source: str | None = None,
    property_id: UUID | None = None,
) -> str:
    """Build an HTML-formatted message suitable for Telegram sendMessage API."""
    lines = ["🚨 <b>New Lead Captured</b>", ""]

    if name:
        lines.append(f"👤 <b>Name:</b> {html.escape(name)}")
    if phone:
        lines.append(f"📞 <b>Phone:</b> <code>{html.escape(phone)}</code>")

    if intent:
        formatted_intent = intent.capitalize()
        if interest:
            formatted_interest = interest.replace("_", " ").title()
            lines.append(f"🎯 <b>Interest:</b> {formatted_intent} ({formatted_interest})")
        else:
            lines.append(f"🎯 <b>Intent:</b> {formatted_intent}")
    elif interest:
        formatted_interest = interest.replace("_", " ").title()
        lines.append(f"🎯 <b>Interest:</b> {formatted_interest}")

    budget_str = format_budget(budget_min, budget_max)
    if budget_str:
        lines.append(f"💰 <b>Budget:</b> {html.escape(budget_str)}")

    if requirements:
        lines.append(f"📝 <b>Requirements:</b> {html.escape(requirements)}")

    if remarks:
        lines.append(f"💡 <b>Remarks:</b> {html.escape(remarks)}")

    if property_id:
        lines.append(f"📍 <b>Property Ref:</b> <code>{property_id}</code>")

    if source:
        formatted_source = source.replace("_", " ").title()
        lines.append(f"🤖 <b>Source:</b> {html.escape(formatted_source)}")

    return "\n".join(lines)


def build_inline_keyboard(phone: str | None) -> dict[str, Any] | None:
    """Build action buttons for WhatsApp."""
    if not phone:
        return None

    buttons = []
    wa_num = to_whatsapp_number(phone)
    if wa_num:
        buttons.append({"text": "💬 WhatsApp Lead", "url": f"https://wa.me/{wa_num}"})

    if not buttons:
        return None

    return {"inline_keyboard": [buttons]}


def send_telegram_notification(
    text: str,
    reply_markup: dict[str, Any] | None = None,
    *,
    sync: bool = False,
) -> bool:
    """Send a notification message to the configured Telegram chat.

    If sync=False (default), dispatches in a daemon thread so agent response latency
    is not impacted by the external HTTP call.
    """
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    chat_id = settings.telegram_chat_id.strip()

    if not token or not chat_id:
        logger.debug("telegram_notification_skipped.unconfigured")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    def _send() -> bool:
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(url, json=payload)
                data = resp.json()
                if not data.get("ok"):
                    logger.warning("telegram_send_failed", status=resp.status_code, response=data)
                    return False
                logger.info("telegram_notification_sent", chat_id=chat_id)
                return True
        except Exception as e:
            logger.warning("telegram_send_error", error=str(e))
            return False

    if sync:
        return _send()

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
    return True


def send_lead_alert(
    *,
    name: str | None = None,
    phone: str | None = None,
    intent: str | None = None,
    interest: str | None = None,
    budget_min: Decimal | None = None,
    budget_max: Decimal | None = None,
    requirements: str | None = None,
    remarks: str | None = None,
    source: str | None = None,
    property_id: UUID | None = None,
    sync: bool = False,
) -> bool:
    """Format and send a new lead alert to Telegram."""
    text = format_lead_message(
        name=name,
        phone=phone,
        intent=intent,
        interest=interest,
        budget_min=budget_min,
        budget_max=budget_max,
        requirements=requirements,
        remarks=remarks,
        source=source,
        property_id=property_id,
    )
    keyboard = build_inline_keyboard(phone)
    return send_telegram_notification(text, reply_markup=keyboard, sync=sync)
