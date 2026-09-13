"""Password and session primitives for staff-only browser authentication."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.auth import StaffSession, StaffUser
from app.schemas.auth import StaffRole

password_hasher = PasswordHasher()
DbSession = Annotated[Session, Depends(get_db)]


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def create_session(db: Session, user: StaffUser) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(days=get_settings().auth_session_days)
    db.add(
        StaffSession(
            user_id=user.id,
            token_hash=_hash_session_token(token),
            expires_at=expires_at,
        )
    )
    db.commit()
    return token


def get_current_user(request: Request, db: DbSession) -> StaffUser:
    session_token = request.cookies.get(get_settings().auth_cookie_name)
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    session = db.scalar(
        select(StaffSession).where(StaffSession.token_hash == _hash_session_token(session_token))
    )
    now = datetime.now(UTC)
    if (
        session is None
        or session.revoked_at is not None
        or _as_utc(session.expires_at) <= now
        or not session.user.is_active
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return session.user


CurrentStaffUser = Annotated[StaffUser, Depends(get_current_user)]


def require_root(user: CurrentStaffUser) -> StaffUser:
    if user.role != StaffRole.ROOT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Root access required.")
    return user


RootStaffUser = Annotated[StaffUser, Depends(require_root)]