"""Staff login and session endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import (
    CurrentStaffUser,
    DbSession,
    RootStaffUser,
    _hash_session_token,
    create_session,
    hash_password,
    verify_password,
)
from app.config import get_settings
from app.models.auth import StaffSession, StaffUser
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    StaffRole,
    StaffUserCreate,
    StaffUserRead,
    StaffUserUpdate,
    PasswordChangeRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: DbSession) -> LoginResponse:
    user = db.scalar(select(StaffUser).where(StaffUser.email == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_session(db, user)
    settings = get_settings()
    response.set_cookie(
        settings.auth_cookie_name,
        token,
        max_age=settings.auth_session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )
    return LoginResponse(user=StaffUserRead.model_validate(user), token=token)


@router.get("/me", response_model=StaffUserRead)
def current_user(user: CurrentStaffUser) -> StaffUserRead:
    return StaffUserRead.model_validate(user)


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChangeRequest, user: CurrentStaffUser, db: DbSession) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password.",
        )
    user.password_hash = hash_password(payload.new_password)
    db.commit()



@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    request: Request,
) -> None:
    session_token = request.cookies.get(get_settings().auth_cookie_name)
    if session_token:
        session = db.scalar(
            select(StaffSession).where(StaffSession.token_hash == _hash_session_token(session_token))
        )
        if session is not None:
            session.revoked_at = datetime.now(UTC)
            db.commit()
    response.delete_cookie(get_settings().auth_cookie_name)


@admin_router.get("", response_model=list[StaffUserRead])
def get_staff_users(db: DbSession, _user: RootStaffUser) -> list[StaffUser]:
    return list(db.scalars(select(StaffUser).order_by(StaffUser.created_at, StaffUser.email)).all())


@admin_router.post("", response_model=StaffUserRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: StaffUserCreate, db: DbSession, _user: RootStaffUser) -> StaffUser:
    agent = StaffUser(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=StaffRole.AGENT,
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
        agent.password_hash = hash_password(changes["password"])
    if "is_active" in changes and changes["is_active"] is not None:
        agent.is_active = changes["is_active"]
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.") from exc
    db.refresh(agent)
    return agent