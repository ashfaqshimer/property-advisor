from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FieldAssignmentCreate(BaseModel):
    prospect_ids: list[UUID]


class FieldAssignmentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    remind_at: datetime | None = None


class FieldAssignmentRead(BaseModel):
    id: UUID
    prospect_id: UUID | None
    assigned_by_id: UUID | None
    status: str
    notes: str | None
    telegram_message_id: int | None
    awaiting_notes: bool
    remind_at: datetime | None = None
    reminder_sent_at: datetime | None = None
    attempt_count: int = 1
    created_at: datetime
    updated_at: datetime

    # Flattened prospect fields for convenience
    prospect_title: str | None = None
    prospect_location: str | None = None
    prospect_price: str | None = None
    prospect_property_type: str | None = None
    prospect_listing_type: str | None = None
    prospect_poster_name: str | None = None
    prospect_phone_number: str | None = None
    prospect_classification: str | None = None
    prospect_confidence: int | None = None
    prospect_ikman_url: str | None = None
    prospect_source_url: str | None = None
    prospect_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


class FieldAssignmentList(BaseModel):
    items: list[FieldAssignmentRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class TelegramCallbackQuery(BaseModel):
    """Incoming callback_query from Telegram (inline button tap)."""
    id: str
    from_: dict
    message: dict | None = None
    data: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class TelegramMessage(BaseModel):
    """Incoming text message from Telegram."""
    message_id: int
    from_: dict | None = None
    chat: dict
    text: str | None = None
    reply_to_message: dict | None = None

    model_config = ConfigDict(populate_by_name=True)


class TelegramUpdate(BaseModel):
    """Root Telegram webhook payload."""
    update_id: int
    message: dict | None = None
    callback_query: dict | None = None

    model_config = ConfigDict(populate_by_name=True)
