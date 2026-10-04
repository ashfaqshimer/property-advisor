"""Telegram dispatch service for field agent assignments.

Sends assignment messages to the agent's private DM and processes
button-tap callbacks and note replies via the webhook.
"""

import html
import re
import threading
from typing import Any

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

# Outcome button definitions: (callback_data, display_label)
OUTCOME_BUTTONS = [
    ("interested", "✅ Interested"),
    ("not_interested", "❌ Not Interested"),
    ("no_answer", "📵 No Answer"),
    ("callback_later", "🔄 Call Back Later"),
]

# Maps assignment status → prospect status update
PROSPECT_STATUS_MAP: dict[str, str | None] = {
    "interested": "contacted",
    "not_interested": "discarded",
    "callback_later": "contacted",
    "no_answer": None,  # no change — eligible for retry
}


def _api_url(token: str, method: str) -> str:
    return f"https://api.telegram.org/bot{token}/{method}"


def _build_assignment_keyboard(assignment_id: str) -> dict[str, Any]:
    """Build a 2×2 inline keyboard for the outcome buttons."""
    buttons = [
        {"text": label, "callback_data": f"fa:{assignment_id}:{data}"}
        for data, label in OUTCOME_BUTTONS
    ]
    # Arrange as two rows of two
    return {"inline_keyboard": [buttons[:2], buttons[2:]]}


def format_assignment_message(
    *,
    poster_name: str | None,
    phone_number: str | None,
    title: str,
    location: str,
    price: str,
    property_type: str,
    listing_type: str,
    classification: str | None = None,
    confidence: int | None = None,
    ikman_url: str,
    assignment_number: int,
    total_assignments: int,
) -> str:
    """Build an HTML-formatted prospect card message for Telegram."""
    lt = listing_type.replace("for_", "").replace("_", " ").title()
    pt = property_type.replace("_", " ").title()

    cl_lower = (classification or "").lower()
    if cl_lower == "owner":
        likely_label = "Direct Owner"
    elif cl_lower in ("agent", "broker"):
        likely_label = "Another Agent / Broker"
    else:
        likely_label = None

    lines = [
        f"📋 <b>New Prospect</b> ({assignment_number}/{total_assignments})",
        "",
        f"👤 <b>Name:</b> {html.escape(poster_name or 'Unknown')}",
    ]

    if phone_number:
        clean_phone = re.sub(r"[^\d+]", "", phone_number)
        if clean_phone.startswith("0") and len(clean_phone) == 10:
            clean_phone = "+94" + clean_phone[1:]
        elif not clean_phone.startswith("+") and len(clean_phone) == 9:
            clean_phone = "+94" + clean_phone
        lines.append(f"📞 <b>Phone:</b> {clean_phone}")

    if likely_label:
        lines.append(f"💡 <b>Probably:</b> {likely_label}")

    lines += [
        f"🏠 <b>Property:</b> {html.escape(title)}",
        f"📍 <b>Location:</b> {html.escape(location)}",
        f"💰 <b>Price:</b> {html.escape(price)}",
        f"🏷️ <b>Type:</b> {pt} • {lt}",
        f'🔗 <a href="{html.escape(ikman_url)}">View on ikman</a>',
    ]
    return "\n".join(lines)


def send_assignment_message(
    *,
    assignment_id: str,
    poster_name: str | None,
    phone_number: str | None,
    title: str,
    location: str,
    price: str,
    property_type: str,
    listing_type: str,
    classification: str | None = None,
    confidence: int | None = None,
    ikman_url: str,
    assignment_number: int = 1,
    total_assignments: int = 1,
) -> int | None:
    """Send an assignment message to the agent. Returns the Telegram message_id or None on failure."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    chat_id = settings.telegram_agent_chat_id.strip() or settings.telegram_chat_id.strip()

    if not token or not chat_id:
        logger.warning("telegram_agent_dispatch_skipped.unconfigured")
        return None

    text = format_assignment_message(
        poster_name=poster_name,
        phone_number=phone_number,
        title=title,
        location=location,
        price=price,
        property_type=property_type,
        listing_type=listing_type,
        classification=classification,
        confidence=confidence,
        ikman_url=ikman_url,
        assignment_number=assignment_number,
        total_assignments=total_assignments,
    )
    keyboard = _build_assignment_keyboard(assignment_id)
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": keyboard,
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(_api_url(token, "sendMessage"), json=payload)
            data = resp.json()
            if not data.get("ok"):
                logger.warning("telegram_assignment_send_failed", response=data)
                return None
            message_id: int = data["result"]["message_id"]
            logger.info("telegram_assignment_sent", assignment_id=assignment_id, message_id=message_id)
            return message_id
    except Exception as exc:
        logger.warning("telegram_assignment_send_error", error=str(exc))
        return None


def answer_callback_query(token: str, callback_query_id: str, text: str = "") -> None:
    """Acknowledge a Telegram callback query (removes the loading spinner)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                _api_url(token, "answerCallbackQuery"),
                json={"callback_query_id": callback_query_id, "text": text},
            )
    except Exception as exc:
        logger.warning("telegram_answer_callback_error", error=str(exc))


def send_notes_prompt(chat_id: str, token: str) -> None:
    """Ask the agent for optional notes after they tap an outcome button."""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": "Any notes? Reply with details or send /skip",
        "parse_mode": "HTML",
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(_api_url(token, "sendMessage"), json=payload)
    except Exception as exc:
        logger.warning("telegram_notes_prompt_error", error=str(exc))


def send_confirmation(chat_id: str, token: str, status: str) -> None:
    """Confirm the recorded outcome to the agent."""
    labels = {
        "interested": "✅ Marked as Interested",
        "not_interested": "❌ Marked as Not Interested",
        "no_answer": "📵 Marked as No Answer",
        "callback_later": "🔄 Marked as Call Back Later",
    }
    label = labels.get(status, f"Recorded: {status}")
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": f"{label}\n\nAny notes? Reply with details or send /skip",
        "parse_mode": "HTML",
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(_api_url(token, "sendMessage"), json=payload)
    except Exception as exc:
        logger.warning("telegram_confirmation_send_error", error=str(exc))


def send_notes_saved(chat_id: str, token: str) -> None:
    """Acknowledge that notes were saved."""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": "✓ Notes saved.",
        "parse_mode": "HTML",
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(_api_url(token, "sendMessage"), json=payload)
    except Exception as exc:
        logger.warning("telegram_notes_saved_send_error", error=str(exc))


def register_webhook(webhook_url: str) -> dict[str, Any]:
    """Register (or update) the bot webhook URL. Call once during setup."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    secret = settings.telegram_webhook_secret.strip()

    payload: dict[str, Any] = {"url": webhook_url}
    if secret:
        payload["secret_token"] = secret

    with httpx.Client(timeout=10.0) as client:
        resp = client.post(_api_url(token, "setWebhook"), json=payload)
        return resp.json()


def get_updates() -> list[dict[str, Any]]:
    """Fetch recent updates (used for one-time chat_id lookup during setup)."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(_api_url(token, "getUpdates"), params={"limit": 10})
        data = resp.json()
        return data.get("result", [])
