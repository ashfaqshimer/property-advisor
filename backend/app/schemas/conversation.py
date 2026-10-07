"""Wire shapes for admin conversation inspection."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lead import LeadRead


class ConversationMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    role: str
    content: str
    tool_payload: dict[str, Any] | None = None
    seq: int
    created_at: datetime


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: str
    created_at: datetime
    updated_at: datetime | None = None
    message_count: int = 0
    preview: str | None = None
    lead: LeadRead | None = None


class ConversationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: str
    created_at: datetime
    updated_at: datetime | None = None
    message_count: int = 0
    lead: LeadRead | None = None
    messages: list[ConversationMessageRead] = Field(default_factory=list)


class ConversationListResponse(BaseModel):
    items: list[ConversationSummary]
    total: int
    offset: int
    limit: int
