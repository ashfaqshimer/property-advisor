"""Staff login and session endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status, Depends
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import (
    CurrentStaffUser,
    DbSession,
    RootStaffUser,
    auth_backend,
    fastapi_users,
)
from app.models.auth import StaffUser
from app.schemas.auth import (
    StaffRole,
    StaffUserCreate,
    StaffUserRead,
    StaffUserUpdate,
)

password_hasher = PasswordHash((BcryptHasher(),))

router = APIRouter(tags=["auth"])

# Include fastapi-users routers
router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth",
)
router.include_router(
    fastapi_users.get_users_router(StaffUserRead, StaffUserUpdate),
    prefix="/auth",
)

admin_router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@admin_router.get("", response_model=list[StaffUserRead])
def get_staff_users(db: DbSession, _user: RootStaffUser) -> list[StaffUser]:
    return list(db.scalars(select(StaffUser).order_by(StaffUser.created_at, StaffUser.email)).all())


@admin_router.post("", response_model=StaffUserRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: StaffUserCreate, db: DbSession, _user: RootStaffUser) -> StaffUser:
    agent = StaffUser(
        name=payload.name,
        email=payload.email.lower(),
        hashed_password=password_hasher.hash(payload.password),
        role=StaffRole.AGENT,
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    db.add(agent)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.") from exc
    db.refresh(agent)
    return agent


@admin_router.patch("/{user_id}", response_model=StaffUserRead)
def update_agent(
    user_id: UUID, payload: StaffUserUpdate, db: DbSession, _user: RootStaffUser
) -> StaffUser:
    agent = db.get(StaffUser, user_id)
    if agent is None or agent.role != StaffRole.AGENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes:
        agent.email = changes["email"].lower()
    if "password" in changes and changes["password"] is not None:
        agent.hashed_password = password_hasher.hash(changes["password"])
    if "is_active" in changes and changes["is_active"] is not None:
        agent.is_active = changes["is_active"]
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.") from exc
    db.refresh(agent)
    return agent