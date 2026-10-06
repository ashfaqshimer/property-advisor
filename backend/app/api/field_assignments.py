"""Field assignment API — admin creates and views assignments, agent reports outcomes via Telegram."""

import math
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.auth import CurrentStaffUser, RootStaffUser
from app.config import get_settings
from app.db.session import get_db
from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.models.scan_job import ScanJob
from app.schemas.auth import StaffRole
from app.schemas.field_assignment import (
    FieldAssignmentCreate,
    FieldAssignmentList,
    FieldAssignmentRead,
    FieldAssignmentUpdate,
)
from app.services.prospect_contacts import fetch_prospect_contact_details
from app.services.telegram_dispatch import (
    PROSPECT_STATUS_MAP,
    calculate_next_reminder_time,
    delete_assignment_message,
    process_due_reminders,
    send_assignment_message,
    sync_telegram_assignment_card,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/admin/field-assignments", tags=["Field Assignments"])
DbSession = Annotated[Session, Depends(get_db)]


def _assignment_to_read(a: FieldAssignment) -> FieldAssignmentRead:
    p = a.prospect
    target_url = (p.source_url or p.ikman_url) if p else None
    return FieldAssignmentRead(
        id=a.id,
        prospect_id=a.prospect_id,
        assigned_by_id=a.assigned_by_id,
        status=a.status,
        notes=a.notes,
        telegram_message_id=a.telegram_message_id,
        awaiting_notes=a.awaiting_notes,
        remind_at=a.remind_at,
        reminder_sent_at=a.reminder_sent_at,
        attempt_count=a.attempt_count or 1,
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
        prospect_source_url=target_url,
        prospect_ikman_url=target_url,
        prospect_status=p.status if p else None,
    )


@router.post("", response_model=list[FieldAssignmentRead])
async def create_assignments(
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

        # Auto-fetch contact details if missing before dispatching
        if not prospect.phone_number:
            try:
                await fetch_prospect_contact_details(prospect, db)
            except Exception as exc:
                logger.warning(
                    "field_assignment_contact_fetch_error",
                    prospect_id=str(prospect.id),
                    error=str(exc),
                )

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
        target_url = prospect.source_url or prospect.ikman_url or ""
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
            listing_url=target_url,
            ikman_url=target_url,
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


@router.patch("/{assignment_id}", response_model=FieldAssignmentRead)
def update_assignment(
    assignment_id: uuid.UUID,
    body: FieldAssignmentUpdate,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> FieldAssignmentRead:
    """Update a field assignment status, notes, or reminder time from the admin panel."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can update field assignments.")

    assignment = db.get(FieldAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    old_status = assignment.status

    if body.notes is not None:
        assignment.notes = body.notes

    if body.status is not None:
        new_status = body.status.strip().lower()
        if new_status == "interested":
            new_status = "contacted"
        if new_status not in {"pending", "contacted", "not_interested", "no_answer", "callback_later"}:
            raise HTTPException(status_code=422, detail=f"Invalid status: {body.status}")

        assignment.status = new_status

        # Reminder scheduling
        if new_status == "no_answer":
            if body.remind_at is not None:
                assignment.remind_at = body.remind_at
            elif not assignment.remind_at or old_status != "no_answer":
                assignment.remind_at = calculate_next_reminder_time()
            assignment.reminder_sent_at = None
        else:
            if body.remind_at is not None:
                assignment.remind_at = body.remind_at
            else:
                assignment.remind_at = None

        # Sync associated prospect status & scan job statistics
        if assignment.prospect_id:
            prospect = db.get(Prospect, assignment.prospect_id)
            if prospect:
                old_prospect_status = prospect.status
                if new_status == "not_interested":
                    prospect.status = "discarded"
                    prospect.discard_reason = "not_interested"
                    if old_prospect_status != "discarded" and prospect.first_scan_job_id:
                        scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                        if scan_job:
                            scan_job.new_count = max(0, (scan_job.new_count or 0) - 1)
                            scan_job.filtered_count = (scan_job.filtered_count or 0) + 1
                elif new_status in ("contacted", "callback_later"):
                    if old_prospect_status == "discarded":
                        prospect.discard_reason = None
                        if prospect.first_scan_job_id:
                            scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                            if scan_job:
                                scan_job.new_count = (scan_job.new_count or 0) + 1
                                scan_job.filtered_count = max(0, (scan_job.filtered_count or 0) - 1)
                    prospect.status = "contacted"
                elif new_status in ("pending", "no_answer"):
                    if old_prospect_status == "discarded" and prospect.discard_reason == "not_interested":
                        prospect.status = "new"
                        prospect.discard_reason = None
                        if prospect.first_scan_job_id:
                            scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                            if scan_job:
                                scan_job.new_count = (scan_job.new_count or 0) + 1
                                scan_job.filtered_count = max(0, (scan_job.filtered_count or 0) - 1)
    elif body.remind_at is not None:
        assignment.remind_at = body.remind_at

    assignment.updated_at = func.now()
    db.commit()
    db.refresh(assignment)

    # Sync telegram message card if present
    if assignment.telegram_message_id:
        try:
            actor = getattr(current_user, "full_name", None) or getattr(current_user, "email", "Staff")
            sync_telegram_assignment_card(
                assignment=assignment,
                status=assignment.status,
                actor_name=f"Admin ({actor})",
            )
        except Exception as exc:
            logger.warning(
                "field_assignment_telegram_edit_error",
                assignment_id=str(assignment_id),
                error=str(exc),
            )

    logger.info("field_assignment_updated", assignment_id=str(assignment_id), status=assignment.status, by=str(current_user.id))
    return _assignment_to_read(assignment)


@router.post("/{assignment_id}/resend", response_model=FieldAssignmentRead)
async def resend_assignment(
    assignment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> FieldAssignmentRead:
    """Resend a prospect assignment card to the agent on Telegram."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can resend field assignments.")

    assignment = db.get(FieldAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    prospect = assignment.prospect
    if not prospect:
        raise HTTPException(status_code=400, detail="Associated prospect not found.")

    if not prospect.phone_number:
        try:
            await fetch_prospect_contact_details(prospect, db)
        except Exception as exc:
            logger.warning(
                "field_assignment_resend_contact_fetch_error",
                prospect_id=str(prospect.id),
                error=str(exc),
            )

    target_url = prospect.source_url or prospect.ikman_url or ""
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
        listing_url=target_url,
        ikman_url=target_url,
    )

    if message_id:
        assignment.telegram_message_id = message_id
    assignment.updated_at = func.now()
    db.commit()
    db.refresh(assignment)

    logger.info("field_assignment_resent", assignment_id=str(assignment_id), message_id=message_id)
    return _assignment_to_read(assignment)


def _delete_assignment_record(assignment: FieldAssignment, db: Session) -> dict[str, Any]:
    assignment_id = str(assignment.id)
    if assignment.telegram_message_id:
        try:
            delete_assignment_message(assignment.telegram_message_id)
        except Exception as exc:
            logger.warning(
                "field_assignment_telegram_delete_error",
                error=str(exc),
                assignment_id=assignment_id,
            )
    db.delete(assignment)
    db.commit()
    logger.info("field_assignment_deleted", assignment_id=assignment_id)
    return {"ok": True, "id": assignment_id}


@router.delete("/by-prospect/{prospect_id}")
def delete_assignment_by_prospect(
    prospect_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> dict[str, Any]:
    """Remove sent assignment for a prospect and delete message from Telegram."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can delete field assignments.")

    assignment = db.scalar(
        select(FieldAssignment)
        .where(FieldAssignment.prospect_id == prospect_id)
        .order_by(desc(FieldAssignment.created_at))
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="No assignment found for this prospect.")

    return _delete_assignment_record(assignment, db)


@router.post("/process-reminders")
def process_field_assignment_reminders(
    db: DbSession,
    current_user: CurrentStaffUser,
) -> dict[str, Any]:
    """Process all due follow-up reminders immediately (admin manual trigger or testing)."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can trigger reminder sweeps.")
    processed = process_due_reminders(db)
    return {"ok": True, "processed": processed, "count": len(processed)}


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentStaffUser,
) -> dict[str, Any]:
    """Remove sent assignment by ID and delete message from Telegram."""
    if current_user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can delete field assignments.")

    assignment = db.get(FieldAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    return _delete_assignment_record(assignment, db)

