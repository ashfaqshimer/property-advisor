"""Property read endpoints."""

from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import queries
from app.db.session import get_db
from app.models.property import ListingType, Property, PropertyStatus, PropertyType
from app.schemas.property import PropertyCreate, PropertyRead, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["properties"])
admin_router = APIRouter(prefix="/admin/properties", tags=["admin-properties"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/images", response_model=list[str])
def upload_property_images(files: Annotated[list[UploadFile], File()]) -> list[str]:
    """Upload listing images to Cloudinary and return their secure URLs."""
    settings = get_settings()
    if not settings.cloudinary_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary is not configured on the backend.",
        )

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    urls: list[str] = []
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=415, detail="Only image files are allowed.")
        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder=settings.cloudinary_folder,
                resource_type="image",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Cloudinary could not store the image.",
            ) from exc
        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(status_code=502, detail="Cloudinary returned no image URL.")
        urls.append(secure_url)
    return urls


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
@admin_router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyCreate, db: DbSession) -> Property:
    property_record = Property(**payload.model_dump())
    db.add(property_record)
    db.commit()
    db.refresh(property_record)
    return property_record


# Keep this above any future "/{property_id}" route, or "featured" gets parsed as a
# UUID and 422s.
@router.get("/featured", response_model=list[PropertyRead])
def get_featured_properties(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=queries.MAX_FEATURED_LIMIT)] = (
        queries.DEFAULT_FEATURED_LIMIT
    ),
) -> Sequence[Property]:
    """Curated set for the homepage grid. Empty table returns [], not a 404."""
    return queries.featured_properties(db, limit=limit)


@admin_router.get("", response_model=list[PropertyRead])
def get_admin_properties(
    db: DbSession,
    search: Annotated[str | None, Query(max_length=120)] = None,
    property_status: Annotated[PropertyStatus | None, Query(alias="status")] = None,
    property_type: PropertyType | None = None,
    listing_type: ListingType | None = None,
    is_featured: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> Sequence[Property]:
    return queries.admin_properties(
        db,
        search=search,
        status=property_status,
        property_type=property_type,
        listing_type=listing_type,
        is_featured=is_featured,
        offset=offset,
        limit=limit,
    )


@admin_router.get("/{property_id}", response_model=PropertyRead)
def get_admin_property(property_id: UUID, db: DbSession) -> Property:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    return property_record


@admin_router.patch("/{property_id}", response_model=PropertyRead)
def update_admin_property(
    property_id: UUID, payload: PropertyUpdate, db: DbSession
) -> Property:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(property_record, field, value)
    db.commit()
    db.refresh(property_record)
    return property_record


@admin_router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_property(property_id: UUID, db: DbSession) -> None:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    db.delete(property_record)
    db.commit()
