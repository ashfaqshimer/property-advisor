"""Site configuration endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy.orm.attributes import flag_modified

from app.auth import RootStaffUser
from app.db.session import get_db
from app.models.site_configuration import SiteConfiguration
from app.schemas.site_configuration import SiteConfigurationResponse, SiteConfigurationUpdate
from app.services.scanner_scheduler import (
    get_next_scan_time,
    remove_property_scanner,
    schedule_property_scanner,
)

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
    if config.scanner_settings:
        settings = dict(config.scanner_settings)
        if not settings.get("enabled"):
            settings["next_run_at"] = None
        else:
            next_run = get_next_scan_time()
            if next_run:
                settings["next_run_at"] = next_run.isoformat()
        config.scanner_settings = settings
    return config


@admin_router.put("", response_model=SiteConfigurationResponse)
def update_site_configuration(
    payload: SiteConfigurationUpdate, db: DbSession, _user: RootStaffUser
) -> SiteConfiguration:
    """Update or create the site configuration."""
    config = db.scalar(select(SiteConfiguration).limit(1))
    
    if not config:
        config = SiteConfiguration(**payload.model_dump(exclude_unset=True, mode='json'))
        db.add(config)
    else:
        for field, value in payload.model_dump(exclude_unset=True, mode='json').items():
            setattr(config, field, value)
            
    db.commit()
    db.refresh(config)

    if payload.scanner_settings is not None:
        settings = dict(config.scanner_settings or {})
        if settings.get("enabled"):
            freq = settings.get("frequency_hours", 24)
            last_run = settings.get("last_run_at")
            next_run = schedule_property_scanner(freq, last_run)
            settings["next_run_at"] = next_run.isoformat() if next_run else None
        else:
            remove_property_scanner()
            settings["next_run_at"] = None

        config.scanner_settings = settings
        flag_modified(config, "scanner_settings")
        db.commit()
        db.refresh(config)

    return config
