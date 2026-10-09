"""WhatsApp Business Cloud API Webhook Router.

Handles:
- GET /whatsapp/webhook: Meta webhook challenge-response verification handshake.
- POST /whatsapp/webhook: Incoming messages, status updates, and property listing submissions.
"""

import hashlib
import hmac
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session
import structlog

from app.config import get_settings
from app.db.session import get_db, SessionLocal
from app.services.whatsapp_inbound import process_inbound_whatsapp_message

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

DbSession = Annotated[Session, Depends(get_db)]


def verify_whatsapp_signature(payload_bytes: bytes, signature_header: str | None) -> bool:
    """Verify HMAC-SHA256 signature from Meta if whatsapp_app_secret is configured."""
    secret = get_settings().whatsapp_app_secret.strip()
    if not secret:
        return True  # Dev mode or secret omitted
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_sig = signature_header.split("sha256=")[-1]
    computed_sig = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(computed_sig, expected_sig)


@router.get("/webhook")
def verify_webhook_challenge(
    hub_mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    hub_verify_token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
    hub_challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
) -> Response:
    """Meta webhook verification endpoint.

    When registering a webhook in Meta App Dashboard, Meta sends a GET request
    with `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`.
    """
    settings = get_settings()
    expected_verify_token = settings.whatsapp_verify_token.strip()

    logger.info(
        "whatsapp_webhook_verification_request",
        hub_mode=hub_mode,
        received_token=hub_verify_token,
    )

    if hub_mode == "subscribe":
        if not expected_verify_token or hub_verify_token == expected_verify_token:
            logger.info("whatsapp_webhook_verified_successfully")
            return Response(content=hub_challenge or "", media_type="text/plain", status_code=200)

    logger.warning("whatsapp_webhook_verification_failed", token_match=bool(hub_verify_token == expected_verify_token))
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")


def _run_inbound_message_background(sender: str, text: str, msg_id: str | None) -> None:
    """Run extraction and persistence in background worker with a fresh DB session."""
    with SessionLocal() as db:
        try:
            process_inbound_whatsapp_message(
                db=db,
                sender_phone=sender,
                message_text=text,
                message_id=msg_id,
            )
        except Exception as exc:
            logger.exception("whatsapp_background_processing_error", error=str(exc), sender=sender)


@router.post("/webhook")
async def receive_whatsapp_event(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Receive incoming WhatsApp messages and status notifications.

    Meta requires an immediate HTTP 200 response; real extraction & database logic
    is dispatched to background tasks.
    """
    body_bytes = await request.body()

    if not verify_whatsapp_signature(body_bytes, x_hub_signature_256):
        logger.warning("whatsapp_invalid_signature")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid request signature",
        )

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored_non_json"}

    # Meta webhook payload structure:
    # {"entry": [{"changes": [{"value": {"messages": [...], "contacts": [...]}}]}]}
    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])

            for msg in messages:
                sender = msg.get("from")
                msg_id = msg.get("id")
                msg_type = msg.get("type")

                message_text = ""
                if msg_type == "text":
                    message_text = msg.get("text", {}).get("body", "")
                elif msg_type == "image":
                    # Image with caption
                    message_text = msg.get("image", {}).get("caption", "")

                if sender and message_text.strip():
                    background_tasks.add_task(
                        _run_inbound_message_background,
                        sender=sender,
                        text=message_text,
                        msg_id=msg_id,
                    )

    return {"status": "ok"}
