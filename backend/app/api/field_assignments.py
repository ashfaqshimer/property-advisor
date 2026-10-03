"""Field assignment API — admin creates and views assignments, agent reports outcomes via Telegram."""

import math
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.auth import CurrentStaffUser, RootStaffUser
from app.db.session import get_db
from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.schemas.auth import StaffRole
from app.schemas.field_assignment import (
    FieldAssignmentCreate,
    FieldAssignmentList,
    FieldAssignmentRead,
)
from app.services.telegram_dispatch import (
    PROSPECT_STATUS_MAP,
    send_assignment_message,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/admin/field-assignments", tags=["Field Assignments"])
DbSession = Annotated[Session, Depends(get_db)]


def _assignment_to_read(a: FieldAssignment) -> FieldAssignmentRead:
    p = a.prospect
    return FieldAssignmentRead(
        id=a.id,
        prospect_id=a.prospect_id,
        assigned_by_id=a.assigned_by_id,
        status=a.status,
        notes=a.notes,
        telegram_message_id=a.telegram_message_id,
        awaiting_notes=a.awaiting_notes,
        created_at=a.created_at,
        updated_at=a.updated_at,
        prospect_title=p.title if p else None,
        prospect_location=p.location if p else None,
        prospect_price=p.price if p else None,
        prospect_property_type=p.property_type if p else None,
        prospect_listing_type=p.listing_type if p else None,
        prospect_poster_name=p.poster_name if p else None,
        prospect_phone_number=p.phone_number if p else None,
        prospect_classification=p.classification if p else None,
        prospect_confidence=p.confidence if p else None,
        prospect_ikman_url=p.ikman_url if p else None,
        prospect_status=p.status if p else None,
    )


@router.post("", response_model=list[FieldAssignmentRead])
def create_assignments(
    body: FieldAssignmentCreate,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> list[FieldAssignmentRead]:
    """Bulk-create field assignments for the selected prospects and dispatch to agent via Telegram."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can create field assignments.")
    if not body.prospect_ids:
        raise HTTPException(status_code=422, detail="No prospect IDs provided.")

    prospects = db.scalars(
        select(Prospect).where(Prospect.id.in_(body.prospect_ids))
    ).all()

    if not prospects:
        raise HTTPException(status_code=404, detail="No matching prospects found.")

    created: list[FieldAssignment] = []

    for i, prospect in enumerate(prospects, start=1):
        # Block re-assignment if there is already an active assignment that was sent
        existing_sent = db.scalar(
            select(FieldAssignment)
            .where(
                FieldAssignment.prospect_id == prospect.id,
                FieldAssignment.status == "pending",
                FieldAssignment.telegram_message_id.is_not(None),
            )
        )
        if existing_sent:
            logger.info(
                "field_assignment_skipped.already_pending",
                prospect_id=str(prospect.id),
            )
            continue

        # Reuse any unsent pending assignment or create new
        assignment = db.scalar(
            select(FieldAssignment)
            .where(
                FieldAssignment.prospect_id == prospect.id,
                FieldAssignment.status == "pending",
                FieldAssignment.telegram_message_id.is_(None),
            )
        )
        if not assignment:
            assignment = FieldAssignment(
                id=uuid.uuid4(),
                prospect_id=prospect.id,
                assigned_by_id=current_user.id,
                status="pending",
            )
            db.add(assignment)
            db.flush()  # get the id before sending

        # Send to Telegram (sync — we need the returned message_id)
        message_id = send_assignment_message(
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
            ikman_url=prospect.ikman_url,
            assignment_number=i,
            total_assignments=len(prospects),
        )
        if message_id:
            assignment.telegram_message_id = message_id

        created.append(assignment)

    db.commit()
    for a in created:
        db.refresh(a)

    logger.info("field_assignments_created", count=len(created), by=str(current_user.id))
    return [_assignment_to_read(a) for a in created]


@router.get("", response_model=FieldAssignmentList)
def list_assignments(
    db: DbSession,
    current_user: CurrentStaffUser,
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> FieldAssignmentList:
    """List all field assignments, optionally filtered by status."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can view field assignments.")
    q = select(FieldAssignment)
    if status:
        q = q.where(FieldAssignment.status == status)
    q = q.order_by(desc(FieldAssignment.created_at))

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()

    return FieldAssignmentList(
        items=[_assignment_to_read(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{assignment_id}", response_model=FieldAssignmentRead)
def get_assignment(
    assignment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> FieldAssignmentRead:
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can view field assignments.")
    a = db.get(FieldAssignment, assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return _assignment_to_read(a)
