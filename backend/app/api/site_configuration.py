"""Site configuration endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentStaffUser
from app.db.session import get_db
from app.models.site_configuration import SiteConfiguration
from app.schemas.site_configuration import SiteConfigurationResponse, SiteConfigurationUpdate

router = APIRouter(prefix="/site-configuration", tags=["site-configuration"])
admin_router = APIRouter(prefix="/admin/site-configuration", tags=["admin-site-configuration"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=SiteConfigurationResponse)
def get_site_configuration(db: DbSession) -> SiteConfiguration:
    """Get the current site configuration.
    
    If no configuration exists, returns a 404.
    """
    config = db.scalar(select(SiteConfiguration).limit(1))
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site configuration not found."
        )
    return config


@admin_router.put("", response_model=SiteConfigurationResponse)
def update_site_configuration(
    payload: SiteConfigurationUpdate, db: DbSession, _user: CurrentStaffUser
) -> SiteConfiguration:
    """Update or create the site configuration."""
    config = db.scalar(select(SiteConfiguration).limit(1))
    
    if not config:
        config = SiteConfiguration(**payload.model_dump(exclude_unset=True))
        db.add(config)
    else:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(config, field, value)
            
    db.commit()
    db.refresh(config)
    return config
