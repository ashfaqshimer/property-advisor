"""Authentication configuration using fastapi-users."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import AuthenticationBackend, CookieTransport
from fastapi_users.authentication.strategy.db import AccessTokenDatabase, DatabaseStrategy
from fastapi_users.db.base import BaseUserDatabase
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.auth import StaffSession, StaffUser
from app.schemas.auth import StaffRole

DbSession = Annotated[Session, Depends(get_db)]


class SyncUserDatabase(BaseUserDatabase[StaffUser, uuid.UUID]):
    def __init__(self, session: Session):
        self.session = session

    async def get(self, id: uuid.UUID) -> Optional[StaffUser]:
        def _get():
            return self.session.get(StaffUser, id)
        return await run_in_threadpool(_get)

    async def get_by_email(self, email: str) -> Optional[StaffUser]:
        def _get():
            return self.session.scalar(select(StaffUser).where(StaffUser.email == email.lower()))
        return await run_in_threadpool(_get)

    async def create(self, create_dict: dict[str, Any]) -> StaffUser:
        def _create():
            user = StaffUser(**create_dict)
            self.session.add(user)
            self.session.commit()
            self.session.refresh(user)
            return user
        return await run_in_threadpool(_create)

    async def update(self, user: StaffUser, update_dict: dict[str, Any]) -> StaffUser:
        def _update():
            for key, value in update_dict.items():
                setattr(user, key, value)
            self.session.commit()
            self.session.refresh(user)
            return user
        return await run_in_threadpool(_update)

    async def delete(self, user: StaffUser) -> None:
        def _delete():
            self.session.delete(user)
            self.session.commit()
        await run_in_threadpool(_delete)


class SyncAccessTokenDatabase(AccessTokenDatabase[StaffSession]):
    def __init__(self, session: Session):
        self.session = session

    async def get_by_token(self, token: str, max_age: Optional[datetime] = None) -> Optional[StaffSession]:
        def _get():
            q = select(StaffSession).where(StaffSession.token == token)
            if max_age is not None:
                q = q.where(StaffSession.created_at >= max_age)
            return self.session.scalar(q)
        return await run_in_threadpool(_get)

    async def create(self, create_dict: dict[str, Any]) -> StaffSession:
        def _create():
            access_token = StaffSession(**create_dict)
            self.session.add(access_token)
            self.session.commit()
            self.session.refresh(access_token)
            return access_token
        return await run_in_threadpool(_create)

    async def update(self, access_token: StaffSession, update_dict: dict[str, Any]) -> StaffSession:
        def _update():
            for key, value in update_dict.items():
                setattr(access_token, key, value)
            self.session.commit()
            self.session.refresh(access_token)
            return access_token
        return await run_in_threadpool(_update)

    async def delete(self, access_token: StaffSession) -> None:
        def _delete():
            self.session.delete(access_token)
            self.session.commit()
        await run_in_threadpool(_delete)


class UserManager(UUIDIDMixin, BaseUserManager[StaffUser, uuid.UUID]):
    reset_password_token_secret = "SECRET_CHANGE_ME"
    verification_token_secret = "SECRET_CHANGE_ME"

    async def on_after_register(self, user: StaffUser, request: Optional[Request] = None):
        pass


def get_user_db(session: DbSession):
    yield SyncUserDatabase(session)


def get_access_token_db(session: DbSession):
    yield SyncAccessTokenDatabase(session)


cookie_transport = CookieTransport(
    cookie_name=get_settings().auth_cookie_name,
    cookie_max_age=get_settings().auth_session_days * 24 * 60 * 60,
    cookie_secure=get_settings().auth_cookie_secure,
    cookie_samesite=get_settings().auth_cookie_samesite,
)


def get_database_strategy(
    access_token_db: SyncAccessTokenDatabase = Depends(get_access_token_db),
) -> DatabaseStrategy:
    return DatabaseStrategy(
        access_token_db, lifetime_seconds=get_settings().auth_session_days * 24 * 60 * 60
    )


auth_backend = AuthenticationBackend(
    name="database",
    transport=cookie_transport,
    get_strategy=get_database_strategy,
)

async def get_user_manager(user_db: SyncUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


fastapi_users = FastAPIUsers[StaffUser, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)

CurrentStaffUser = Annotated[StaffUser, Depends(current_active_user)]
RootStaffUser = Annotated[StaffUser, Depends(current_superuser)]