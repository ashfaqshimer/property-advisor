"""Staff identities and revocable browser sessions."""

import uuid
from datetime import datetime

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyBaseAccessTokenTableUUID
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StaffUser(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "staff_users"

    name: Mapped[str] = mapped_column(String(120), nullable=False, default="root", server_default="root")
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="root", server_default="root")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sessions: Mapped[list["StaffSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


from fastapi_users_db_sqlalchemy.generics import GUID

class StaffSession(SQLAlchemyBaseAccessTokenTableUUID, Base):
    __tablename__ = "staff_sessions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("staff_users.id", ondelete="cascade"), nullable=False
    )

    user: Mapped[StaffUser] = relationship(back_populates="sessions")