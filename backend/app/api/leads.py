"""Admin lead read endpoints."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth import CurrentStaffUser
from app.agent.loop import get_or_create_conversation
from app.models.conversation import Conversation
from app.models.lead import Lead, LeadIntent, LeadInterest, LeadSource
from app.schemas.lead import (
    FallbackLeadRequest,
    FallbackLeadResponse,
    LeadRead,
    ManualLeadCreate,
)

router = APIRouter(prefix="/admin/leads", tags=["admin-leads"])
public_router = APIRouter(tags=["leads"])
DbSession = Annotated[Session, Depends(get_db)]


def _capture_fallback_lead(
    db: Session, payload: FallbackLeadRequest
) -> FallbackLeadResponse:
    conversation = get_or_create_conversation(db, payload.session_id)
    lead = db.execute(
        select(Lead).where(Lead.conversation_id == conversation.id)
    ).scalar_one_or_none()
    if lead is None:
        lead = Lead(conversation_id=conversation.id, source=LeadSource.FALLBACK)
        db.add(lead)

    lead.name = payload.name
    lead.phone = payload.phone
    lead.requirements = "Requested a call because chat was unavailable."
    if not lead.remarks:
        lead.remarks = "Chat was unavailable when this callback request was submitted."
    db.commit()
    return FallbackLeadResponse()


@public_router.post("/leads/fallback", response_model=FallbackLeadResponse)
def capture_fallback_lead(
    payload: FallbackLeadRequest, db: DbSession
) -> FallbackLeadResponse:
    """Capture a callback request without involving the AI agent."""
    try:
        return _capture_fallback_lead(db, payload)
    except IntegrityError:
        # A second tab or double-submit may win creation of the same session first.
        db.rollback()
        return _capture_fallback_lead(db, payload)


@router.get("", response_model=list[LeadRead])
def get_admin_leads(
    db: DbSession,
    _user: CurrentStaffUser,
    search: Annotated[str | None, Query(max_length=120)] = None,
    intent: LeadIntent | None = None,
    interest: LeadInterest | None = None,
    source: LeadSource | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> Sequence[Lead]:
    stmt = select(Lead)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.name.ilike(term),
                Lead.phone.ilike(term),
                Lead.requirements.ilike(term),
                Lead.remarks.ilike(term),
            )
        )
    if intent is not None:
        stmt = stmt.where(Lead.intent == intent)
    if interest is not None:
        stmt = stmt.where(Lead.interest == interest)
    if source is not None:
        stmt = stmt.where(Lead.source == source)
    stmt = stmt.order_by(Lead.created_at.desc(), Lead.id).offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_manual_lead(
    payload: ManualLeadCreate, db: DbSession, _user: CurrentStaffUser
) -> Lead:
    if payload.conversation_id is not None:
        conversation = db.get(Conversation, payload.conversation_id)
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        existing = db.scalar(
            select(Lead).where(Lead.conversation_id == payload.conversation_id)
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A lead already exists for this conversation.",
            )

    lead = Lead(
        **payload.model_dump(),
        source=LeadSource.MANUAL,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
