"""Telegram webhook receiver for field agent assignment outcomes.

Handles:
  - callback_query: inline button taps  (fa:<assignment_id>:<status>)
  - message:        free-text note replies and /skip command
"""

from typing import Annotated
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.models.scan_job import ScanJob
from app.services.telegram_dispatch import (
    PROSPECT_STATUS_MAP,
    answer_callback_query,
    get_updates,
    register_webhook,
    send_confirmation,
    send_notes_saved,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/telegram", tags=["Telegram"])


def _get_agent_chat_id() -> str:
    return get_settings().telegram_agent_chat_id.strip()


def _is_authorized_chat(chat_id: str, sender_id: str) -> bool:
    """Allow updates if they come from the designated assignment chat, agent DM, or general chat."""
    settings = get_settings()
    legacy_agent_id = _get_agent_chat_id()
    allowed = {
        c.strip()
        for c in (
            settings.telegram_assignments_chat_id,
            legacy_agent_id,
            settings.telegram_chat_id,
        )
        if c.strip()
    }
    if not allowed:
        return True  # Dev mode / unconfigured — accept all
    return chat_id in allowed or sender_id in allowed


def _get_token() -> str:
    return get_settings().telegram_bot_token.strip()


def _validate_secret(x_telegram_bot_api_secret_token: str | None) -> None:
    """Reject webhook calls that don't carry the configured secret."""
    secret = get_settings().telegram_webhook_secret.strip()
    if not secret:
        return  # secret not configured — accept all (dev mode)
    if x_telegram_bot_api_secret_token != secret:
        raise HTTPException(status_code=403, detail="Invalid webhook secret.")


def _handle_callback_query(db: Session, cq: dict) -> None:
    """Process an inline button tap from the agent or team group."""
    cq_id: str = cq["id"]
    from_user = cq.get("from", {})
    user_id = str(from_user.get("id", ""))
    msg = cq.get("message") or {}
    msg_chat = msg.get("chat") or {}
    origin_chat_id = str(msg_chat.get("id") or user_id)
    thread_id = msg.get("message_thread_id")
    data: str = cq.get("data", "")
    token = _get_token()

    # Only accept callbacks from authorized chats/agents
    if not _is_authorized_chat(origin_chat_id, user_id):
        answer_callback_query(token, cq_id)
        return

    # Expected format: fa:<assignment_id>:<status>
    parts = data.split(":")
    if len(parts) != 3 or parts[0] != "fa":
        answer_callback_query(token, cq_id, "Unknown action.")
        return

    _, assignment_id_str, new_status = parts
    if new_status not in PROSPECT_STATUS_MAP:
        answer_callback_query(token, cq_id, "Unknown status.")
        return

    try:
        import uuid
        assignment_id = uuid.UUID(assignment_id_str)
    except ValueError:
        answer_callback_query(token, cq_id, "Invalid assignment ID.")
        return

    assignment = db.get(FieldAssignment, assignment_id)
    if not assignment:
        answer_callback_query(token, cq_id, "Assignment not found.")
        return

    # Update status
    assignment.status = new_status

    # Sync prospect status if applicable
    prospect_new_status = PROSPECT_STATUS_MAP.get(new_status)
    if prospect_new_status and assignment.prospect_id:
        prospect = db.get(Prospect, assignment.prospect_id)
        if prospect:
            old_status = prospect.status
            prospect.status = prospect_new_status
            if prospect_new_status == "discarded":
                prospect.discard_reason = "not_interested"
                if old_status != "discarded" and prospect.first_scan_job_id:
                    scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                    if scan_job:
                        scan_job.new_count = max(0, (scan_job.new_count or 0) - 1)
                        scan_job.filtered_count = (scan_job.filtered_count or 0) + 1
            elif old_status == "discarded" and prospect_new_status != "discarded":
                prospect.discard_reason = None
                if prospect.first_scan_job_id:
                    scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                    if scan_job:
                        scan_job.new_count = (scan_job.new_count or 0) + 1
                        scan_job.filtered_count = max(0, (scan_job.filtered_count or 0) - 1)

    # Flag as awaiting notes (unless no_answer — notes optional but still prompted)
    assignment.awaiting_notes = True
    db.commit()

    user_name = from_user.get("first_name") or from_user.get("username")
    answer_callback_query(token, cq_id)
    send_confirmation(
        origin_chat_id,
        token,
        new_status,
        user_name=user_name,
        thread_id=thread_id,
    )
    logger.info(
        "field_assignment_outcome_received",
        assignment_id=assignment_id_str,
        status=new_status,
        actor_id=user_id,
        actor_name=user_name,
    )


def _handle_message(db: Session, msg: dict) -> None:
    """Process a text reply (notes or /skip) from the agent or team group."""
    chat_id: str = str(msg["chat"]["id"])
    from_user = msg.get("from", {})
    user_id = str(from_user.get("id", ""))
    thread_id = msg.get("message_thread_id")
    text: str = (msg.get("text") or "").strip()
    token = _get_token()

    # Only accept messages from authorized chats/agents
    if not _is_authorized_chat(chat_id, user_id):
        return

    # Find the most recent assignment awaiting notes
    assignment = db.scalar(
        select(FieldAssignment)
        .where(FieldAssignment.awaiting_notes.is_(True))
        .order_by(FieldAssignment.updated_at.desc())
    )
    if not assignment:
        return  # not in notes-capture mode — ignore

    if text.lower() == "/skip" or not text:
        assignment.awaiting_notes = False
        db.commit()
        send_notes_saved(chat_id, token, thread_id=thread_id)
    else:
        assignment.notes = text
        assignment.awaiting_notes = False
        db.commit()
        send_notes_saved(chat_id, token, thread_id=thread_id)
        logger.info(
            "field_assignment_notes_saved",
            assignment_id=str(assignment.id),
            notes_length=len(text),
        )


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    """Receive updates from Telegram (button taps + text replies)."""
    _validate_secret(x_telegram_bot_api_secret_token)

    update = await request.json()
    logger.debug("telegram_webhook_received", update_id=update.get("update_id"))

    if cq := update.get("callback_query"):
        _handle_callback_query(db, cq)
    elif msg := update.get("message"):
        _handle_message(db, msg)

    return {"ok": True}


@router.post("/setup/webhook")
def setup_webhook(
    webhook_url: str,
) -> dict:
    """Register the bot webhook URL with Telegram. Root-only, call once."""
    result = register_webhook(webhook_url)
    logger.info("telegram_webhook_registered", result=result)
    return result


@router.get("/setup/chat-id")
def get_agent_chat_id() -> dict:
    """One-time helper: fetch recent updates to find the agent's chat_id.

    Have the agent send any message to the bot first, then call this endpoint.
    Root-only — remove or guard with auth before production use.
    """
    updates = get_updates()
    chats = []
    for u in updates:
        msg = u.get("message") or u.get("callback_query", {}).get("message")
        if msg and msg.get("chat"):
            c = msg["chat"]
            chats.append({"chat_id": c["id"], "username": c.get("username"), "first_name": c.get("first_name")})
    seen = {c["chat_id"] for c in chats}
    unique_chats = [c for i, c in enumerate(chats) if c["chat_id"] not in {x["chat_id"] for x in chats[:i]}]
    return {"updates": len(updates), "chats": unique_chats}
