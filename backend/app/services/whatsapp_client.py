"""WhatsApp Business Cloud API client.

Handles outbound messaging (text replies, acknowledgements) via Meta's Graph API.
Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


class WhatsAppClient:
    """Client for Meta's WhatsApp Business Cloud API."""

    def __init__(
        self,
        access_token: str | None = None,
        phone_number_id: str | None = None,
        api_version: str | None = None,
    ) -> None:
        settings = get_settings()
        self.access_token = access_token or settings.whatsapp_access_token.strip()
        self.phone_number_id = phone_number_id or settings.whatsapp_phone_number_id.strip()
        self.api_version = api_version or settings.whatsapp_api_version.strip()
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.phone_number_id)

    def send_text_message(
        self,
        to_phone: str,
        message: str,
        preview_url: bool = False,
    ) -> dict | None:
        """Send a plain text message to a WhatsApp recipient phone number synchronously or in background."""
        if not self.is_configured:
            logger.warning(
                "whatsapp_client_unconfigured",
                reason="Missing whatsapp_access_token or whatsapp_phone_number_id",
            )
            return None

        # Normalize phone: ensure only digits, e.g. "94771234567"
        clean_phone = "".join(ch for ch in to_phone if ch.isdigit())

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": message,
            },
        }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(self.base_url, json=payload, headers=headers)
                if response.status_code >= 400:
                    logger.error(
                        "whatsapp_send_failed",
                        status_code=response.status_code,
                        response=response.text,
                        to=clean_phone,
                    )
                    return None
                data = response.json()
                logger.info("whatsapp_message_sent", to=clean_phone, message_id=data.get("messages", [{}])[0].get("id"))
                return data
        except Exception as exc:
            logger.exception("whatsapp_send_exception", error=str(exc), to=clean_phone)
            return None
