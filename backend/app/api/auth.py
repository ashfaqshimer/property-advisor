"""Staff login and session endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from app.auth import (
    CurrentStaffUser,
    DbSession,
    _hash_session_token,
    create_session,
    verify_password,
)
from app.config import get_settings
from app.models.auth import StaffSession, StaffUser
from app.schemas.auth import LoginRequest, LoginResponse, StaffUserRead

router = APIRouter(prefix="/auth", tags=["auth"])


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
    return LoginResponse(user=StaffUserRead.model_validate(user))


@router.get("/me", response_model=StaffUserRead)
def current_user(user: CurrentStaffUser) -> StaffUserRead:
    return StaffUserRead.model_validate(user)


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