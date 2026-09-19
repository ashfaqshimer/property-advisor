"""Wire shapes for staff authentication."""

from datetime import datetime
from uuid import UUID

from fastapi_users import schemas
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StaffRole:
    ROOT = "root"
    AGENT = "agent"


class StaffUserRead(schemas.BaseUser[UUID]):
    name: str
    role: str
    created_at: datetime


class StaffUserCreate(schemas.BaseUserCreate):
    name: str = Field(min_length=1, max_length=120)


class StaffUserUpdate(schemas.BaseUserUpdate):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=20)


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)