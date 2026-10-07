"""Admin conversation read and management endpoints."""

from typing import Annotated
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentStaffUser
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message, MessageRole
from app.schemas.auth import StaffRole
from app.schemas.conversation import (
    ConversationDetail,
    ConversationListResponse,
    ConversationMessageRead,
    ConversationSummary,
)

admin_router = APIRouter(prefix="/admin/conversations", tags=["admin-conversations"])
DbSession = Annotated[Session, Depends(get_db)]


def _require_admin_or_root(user: CurrentStaffUser) -> None:
    if user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Root permissions required to view conversations.",
        )


@admin_router.get("", response_model=ConversationListResponse)
def list_admin_conversations(
    db: DbSession,
    user: CurrentStaffUser,
    search: Annotated[str | None, Query(max_length=120)] = None,
    has_lead: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ConversationListResponse:
    """Lists conversations with message counts and lead summaries for Admin and Root users."""
    _require_admin_or_root(user)

    stmt = select(Conversation)
    count_stmt = select(func.count(Conversation.id))

    if search:
        clean_search = search.strip()
        term = f"%{clean_search}%"

        conditions = [Conversation.session_id.ilike(term)]

        # Check if valid UUID was searched directly
        try:
            parsed_uuid = uuid.UUID(clean_search)
            conditions.append(Conversation.id == parsed_uuid)
        except ValueError:
            pass

        # Subquery for messages
        msg_subq = select(Message.conversation_id).where(Message.content.ilike(term))
        conditions.append(Conversation.id.in_(msg_subq))

        # Subquery for leads
        lead_subq = select(Lead.conversation_id).where(
            or_(
                Lead.name.ilike(term),
                Lead.phone.ilike(term),
                Lead.requirements.ilike(term),
                Lead.remarks.ilike(term),
            )
        )
        conditions.append(Conversation.id.in_(lead_subq))

        combined_search = or_(*conditions)
        stmt = stmt.where(combined_search)
        count_stmt = count_stmt.where(combined_search)

    if has_lead is True:
        lead_subq = select(Lead.conversation_id).where(Lead.conversation_id.is_not(None))
        stmt = stmt.where(Conversation.id.in_(lead_subq))
        count_stmt = count_stmt.where(Conversation.id.in_(lead_subq))
    elif has_lead is False:
        lead_subq = select(Lead.conversation_id).where(Lead.conversation_id.is_not(None))
        stmt = stmt.where(Conversation.id.not_in(lead_subq))
        count_stmt = count_stmt.where(Conversation.id.not_in(lead_subq))

    total = db.scalar(count_stmt) or 0

    stmt = (
        stmt.options(
            selectinload(Conversation.lead).selectinload(Lead.edited_by),
            selectinload(Conversation.messages),
        )
        .order_by(Conversation.created_at.desc(), Conversation.id)
        .offset(offset)
        .limit(limit)
    )

    conversations = db.execute(stmt).scalars().all()

    items: list[ConversationSummary] = []
    for conv in conversations:
        msgs = conv.messages
        preview: str | None = None
        for m in msgs:
            if m.role == MessageRole.USER and m.content:
                preview = m.content[:160]
                break
        if not preview and msgs:
            for m in reversed(msgs):
                if m.content:
                    preview = m.content[:160]
                    break

        last_updated = msgs[-1].created_at if msgs else conv.created_at

        items.append(
            ConversationSummary(
                id=conv.id,
                session_id=conv.session_id,
                created_at=conv.created_at,
                updated_at=last_updated,
                message_count=len(msgs),
                preview=preview,
                lead=conv.lead,
            )
        )

    return ConversationListResponse(
        items=items,
        total=total,
        offset=offset,
        limit=limit,
    )


@admin_router.get("/{conversation_id}", response_model=ConversationDetail)
def get_admin_conversation(
    conversation_id: UUID,
    db: DbSession,
    user: CurrentStaffUser,
) -> ConversationDetail:
    """Retrieve full transcript and lead association for a single conversation."""
    _require_admin_or_root(user)

    stmt = (
        select(Conversation)
        .options(
            selectinload(Conversation.lead).selectinload(Lead.edited_by),
            selectinload(Conversation.messages),
        )
        .where(Conversation.id == conversation_id)
    )
    conv = db.execute(stmt).scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    msgs = conv.messages
    last_updated = msgs[-1].created_at if msgs else conv.created_at

    return ConversationDetail(
        id=conv.id,
        session_id=conv.session_id,
        created_at=conv.created_at,
        updated_at=last_updated,
        message_count=len(msgs),
        lead=conv.lead,
        messages=[
            ConversationMessageRead(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role.value if hasattr(m.role, "value") else str(m.role),
                content=m.content,
                tool_payload=m.tool_payload,
                seq=m.seq,
                created_at=m.created_at,
            )
            for m in msgs
        ],
    )


@admin_router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_conversation(
    conversation_id: UUID,
    db: DbSession,
    user: CurrentStaffUser,
):
    """Delete a conversation and its messages."""
    _require_admin_or_root(user)

    conv = db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    db.delete(conv)
    db.commit()
