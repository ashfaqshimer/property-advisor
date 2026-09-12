"""Admin lead read endpoints."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.lead import Lead, LeadIntent
from app.schemas.lead import LeadRead

router = APIRouter(prefix="/admin/leads", tags=["admin-leads"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[LeadRead])
def get_admin_leads(
    db: DbSession,
    search: Annotated[str | None, Query(max_length=120)] = None,
    intent: LeadIntent | None = None,
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
                Lead.preferences.ilike(term),
            )
        )
    if intent is not None:
        stmt = stmt.where(Lead.intent == intent)
    stmt = stmt.order_by(Lead.created_at.desc(), Lead.id).offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()
