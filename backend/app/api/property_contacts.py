"""CRUD endpoints for `property_contacts`."""

from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import CurrentStaffUser
from app.db.session import get_db
from app.models.property_contact import PropertyContact, PropertyContactPhone
from app.schemas.property_contact import (
    PropertyContactCreate,
    PropertyContactRead,
    PropertyContactUpdate,
)

router = APIRouter(prefix="/admin/property-contacts", tags=["admin-property-contacts"])
DbSession = Annotated[Session, Depends(get_db)]


def _replace_phones(
    db: Session,
    contact: PropertyContact,
    phone_payloads: list,
) -> None:
    """Delete existing phones and insert the new list in one flush."""
    for phone in list(contact.phones):
        db.delete(phone)
    db.flush()
    for p in phone_payloads:
        db.add(
            PropertyContactPhone(
                property_contact_id=contact.id,
                phone=p.phone,
                label=p.label,
                is_whatsapp=p.is_whatsapp,
            )
        )


@router.get("", response_model=list[PropertyContactRead])
def list_property_contacts(
    db: DbSession,
    _user: CurrentStaffUser,
    search: Annotated[str | None, Query(max_length=120)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> Sequence[PropertyContact]:
    stmt = select(PropertyContact)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                PropertyContact.full_name.ilike(term),
                PropertyContact.company_name.ilike(term),
                PropertyContact.email.ilike(term),
            )
        )
    stmt = stmt.order_by(PropertyContact.full_name, PropertyContact.id).offset(offset).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=PropertyContactRead, status_code=status.HTTP_201_CREATED)
def create_property_contact(
    payload: PropertyContactCreate,
    db: DbSession,
    _user: CurrentStaffUser,
) -> PropertyContact:
    contact = PropertyContact(
        contact_type=payload.contact_type,
        full_name=payload.full_name,
        company_name=payload.company_name,
        email=payload.email,
        notes=payload.notes,
    )
    db.add(contact)
    db.flush()  # populate contact.id before inserting phones
    for p in payload.phones:
        db.add(
            PropertyContactPhone(
                property_contact_id=contact.id,
                phone=p.phone,
                label=p.label,
                is_whatsapp=p.is_whatsapp,
            )
        )
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=PropertyContactRead)
def get_property_contact(
    contact_id: UUID,
    db: DbSession,
    _user: CurrentStaffUser,
) -> PropertyContact:
    contact = db.get(PropertyContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found.")
    return contact


@router.patch("/{contact_id}", response_model=PropertyContactRead)
def update_property_contact(
    contact_id: UUID,
    payload: PropertyContactUpdate,
    db: DbSession,
    _user: CurrentStaffUser,
) -> PropertyContact:
    contact = db.get(PropertyContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found.")

    changes = payload.model_dump(exclude_unset=True)
    phone_payloads = changes.pop("phones", None)

    for field, value in changes.items():
        setattr(contact, field, value)

    if phone_payloads is not None:
        _replace_phones(db, contact, payload.phones or [])

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property_contact(
    contact_id: UUID,
    db: DbSession,
    _user: CurrentStaffUser,
) -> None:
    contact = db.get(PropertyContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found.")
    db.delete(contact)
    db.commit()
