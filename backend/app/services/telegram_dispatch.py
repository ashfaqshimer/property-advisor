"""Telegram dispatch service for field agent assignments.

Sends assignment messages to the agent's private DM and processes
button-tap callbacks and note replies via the webhook.
"""

from datetime import datetime, timedelta, timezone
import html
import re
import threading
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

COLOMBO_TZ = ZoneInfo("Asia/Colombo")


def calculate_next_reminder_time(
    from_dt: datetime | None = None,
    target_hour: int = 10,
    target_minute: int = 0,
) -> datetime:
    """Calculate target_hour:target_minute next day in Colombo time (UTC+5:30), returned in UTC."""
    now_utc = from_dt or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    now_colombo = now_utc.astimezone(COLOMBO_TZ)
    next_day_colombo = (now_colombo + timedelta(days=1)).replace(
        hour=target_hour, minute=target_minute, second=0, microsecond=0
    )
    return next_day_colombo.astimezone(timezone.utc)


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
    ikman_url: str | None = None,
    listing_url: str | None = None,
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
        conf_suffix = ""
        if confidence is not None:
            conf_val = int(confidence * 100) if isinstance(confidence, float) and 0 < confidence <= 1 else int(confidence)
            conf_suffix = f" ({conf_val}% confidence)"
        lines.append(f"💡 <b>Probably:</b> {likely_label}{conf_suffix}")

    lines += [
        f"🏠 <b>Property:</b> {html.escape(title)}",
        f"📍 <b>Location:</b> {html.escape(location)}",
        f"💰 <b>Price:</b> {html.escape(price)}",
        f"🏷️ <b>Type:</b> {pt} • {lt}",
    ]

    target_url = listing_url or ikman_url
    if target_url:
        lines.append(f'🔗 <a href="{html.escape(target_url)}">View Listing</a>')

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
    ikman_url: str | None = None,
    listing_url: str | None = None,
    assignment_number: int = 1,
    total_assignments: int = 1,
) -> int | None:
    """Send an assignment message to the agent. Returns the Telegram message_id or None on failure."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    chat_id = (
        settings.telegram_assignments_chat_id.strip()
        or settings.telegram_agent_chat_id.strip()
        or settings.telegram_chat_id.strip()
    )
    thread_id = settings.telegram_assignments_thread_id

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
        listing_url=listing_url,
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
    if thread_id is not None and str(chat_id).startswith("-"):
        payload["message_thread_id"] = thread_id

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


def delete_assignment_message(message_id: int) -> bool:
    """Delete an assignment message from Telegram. Returns True if deleted, False otherwise."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    chat_id = (
        settings.telegram_assignments_chat_id.strip()
        or settings.telegram_agent_chat_id.strip()
        or settings.telegram_chat_id.strip()
    )

    if not token or not chat_id or not message_id:
        return False

    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(
                _api_url(token, "deleteMessage"),
                json={"chat_id": chat_id, "message_id": message_id},
            )
            data = resp.json()
            if not data.get("ok"):
                logger.warning("telegram_assignment_delete_failed", response=data, message_id=message_id)
                return False
            logger.info("telegram_assignment_deleted", message_id=message_id)
            return True
    except Exception as exc:
        logger.warning("telegram_assignment_delete_error", error=str(exc), message_id=message_id)
        return False


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


def send_notes_prompt(chat_id: str, token: str, thread_id: int | None = None) -> None:
    """Ask the agent for optional notes after they tap an outcome button."""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": "Any notes? Reply with details or send /skip",
        "parse_mode": "HTML",
    }
    if thread_id is not None and str(chat_id).startswith("-"):
        payload["message_thread_id"] = thread_id
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(_api_url(token, "sendMessage"), json=payload)
    except Exception as exc:
        logger.warning("telegram_notes_prompt_error", error=str(exc))


def send_confirmation(
    chat_id: str,
    token: str,
    status: str,
    user_name: str | None = None,
    thread_id: int | None = None,
) -> None:
    """Confirm the recorded outcome to the agent or team group."""
    labels = {
        "interested": "✅ Marked as Interested",
        "not_interested": "❌ Marked as Not Interested",
        "no_answer": "📵 Marked as No Answer\n⏰ Reminder scheduled for tomorrow around 10:00 AM",
        "callback_later": "🔄 Marked as Call Back Later",
    }
    label = labels.get(status, f"Recorded: {status}")
    by_suffix = f" by {html.escape(user_name)}" if user_name else ""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": f"{label}{by_suffix}\n\nAny notes? Reply with details or send /skip",
        "parse_mode": "HTML",
    }
    if thread_id is not None and str(chat_id).startswith("-"):
        payload["message_thread_id"] = thread_id
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(_api_url(token, "sendMessage"), json=payload)
    except Exception as exc:
        logger.warning("telegram_confirmation_send_error", error=str(exc))


def format_reminder_message(
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
    ikman_url: str | None = None,
    listing_url: str | None = None,
    attempt_count: int = 1,
) -> str:
    """Build an HTML-formatted reminder card message for Telegram."""
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
        f"⏰ <b>Follow-up Reminder: Call Prospect</b> (Attempt #{attempt_count})",
        "<i>You marked this prospect as No Answer previously.</i>",
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
        conf_suffix = ""
        if confidence is not None:
            conf_val = int(confidence * 100) if isinstance(confidence, float) and 0 < confidence <= 1 else int(confidence)
            conf_suffix = f" ({conf_val}% confidence)"
        lines.append(f"💡 <b>Probably:</b> {likely_label}{conf_suffix}")

    lines += [
        f"🏠 <b>Property:</b> {html.escape(title)}",
        f"📍 <b>Location:</b> {html.escape(location)}",
        f"💰 <b>Price:</b> {html.escape(price)}",
        f"🏷️ <b>Type:</b> {pt} • {lt}",
    ]

    target_url = listing_url or ikman_url
    if target_url:
        lines.append(f'🔗 <a href="{html.escape(target_url)}">View Listing</a>')

    return "\n".join(lines)


def send_reminder_message(
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
    ikman_url: str | None = None,
    listing_url: str | None = None,
    attempt_count: int = 1,
) -> int | None:
    """Send a follow-up reminder card to the agent. Returns the Telegram message_id or None on failure."""
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    chat_id = (
        settings.telegram_assignments_chat_id.strip()
        or settings.telegram_agent_chat_id.strip()
        or settings.telegram_chat_id.strip()
    )
    thread_id = settings.telegram_assignments_thread_id

    if not token or not chat_id:
        logger.warning("telegram_reminder_dispatch_skipped.unconfigured")
        return None

    text = format_reminder_message(
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
        listing_url=listing_url,
        attempt_count=attempt_count,
    )
    keyboard = _build_assignment_keyboard(assignment_id)
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": keyboard,
    }
    if thread_id is not None and str(chat_id).startswith("-"):
        payload["message_thread_id"] = thread_id

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(_api_url(token, "sendMessage"), json=payload)
            data = resp.json()
            if not data.get("ok"):
                logger.warning("telegram_reminder_send_failed", response=data)
                return None
            message_id: int = data["result"]["message_id"]
            logger.info("telegram_reminder_sent", assignment_id=assignment_id, message_id=message_id)
            return message_id
    except Exception as exc:
        logger.warning("telegram_reminder_send_error", error=str(exc))
        return None


def process_due_reminders(db: Any) -> list[str]:
    """Find and send due reminders for field assignments with status 'no_answer'. Returns list of processed assignment IDs."""
    from sqlalchemy import select, func
    from app.models.field_assignment import FieldAssignment

    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(FieldAssignment)
        .where(
            FieldAssignment.status == "no_answer",
            FieldAssignment.remind_at.is_not(None),
            FieldAssignment.remind_at <= now_utc,
            FieldAssignment.reminder_sent_at.is_(None),
        )
    )
    due_assignments = db.scalars(stmt).all()
    processed_ids: list[str] = []

    for assignment in due_assignments:
        prospect = assignment.prospect
        if not prospect:
            assignment.remind_at = None
            continue

        target_url = prospect.source_url or prospect.ikman_url or ""
        next_attempt = (assignment.attempt_count or 1) + 1
        msg_id = send_reminder_message(
            assignment_id=str(assignment.id),
            poster_name=prospect.poster_name,
            phone_number=prospect.phone_number,
            title=prospect.title,
            location=prospect.location,
            price=prospect.price,
            property_type=prospect.property_type,
            listing_type=prospect.listing_type,
            classification=prospect.classification,
            confidence=prospect.confidence,
            listing_url=target_url,
            ikman_url=target_url,
            attempt_count=next_attempt,
        )

        if msg_id:
            assignment.attempt_count = next_attempt
            assignment.telegram_message_id = msg_id
            assignment.reminder_sent_at = now_utc
            assignment.remind_at = None
            assignment.updated_at = func.now()
            processed_ids.append(str(assignment.id))

    if processed_ids:
        db.commit()
        logger.info("field_assignment_reminders_processed", count=len(processed_ids))

    return processed_ids


def send_notes_saved(chat_id: str, token: str, thread_id: int | None = None) -> None:
    """Acknowledge that notes were saved."""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": "✓ Notes saved.",
        "parse_mode": "HTML",
    }
    if thread_id is not None and str(chat_id).startswith("-"):
        payload["message_thread_id"] = thread_id
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
