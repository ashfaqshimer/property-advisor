from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime

from app.auth import RootStaffUser, CurrentStaffUser
from app.schemas.auth import StaffRole
from app.db.session import get_db
from app.models.site_configuration import SiteConfiguration
from app.schemas.site_configuration import SiteConfigurationResponse, SiteConfigurationUpdate
from app.services.scanner_scheduler import (
    get_next_scan_time,
    get_scanner_next_run_time,
    remove_property_scanner,
    schedule_property_scanner,
    sync_all_scanner_schedules,
    run_automated_scanner,
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
        if "presets" not in settings or settings.get("presets") is None:
            from app.schemas.site_configuration import DEFAULT_SCAN_PRESETS
            settings["presets"] = DEFAULT_SCAN_PRESETS

        # Ensure automated scanners list is populated
        if not settings.get("scanners"):
            from app.schemas.site_configuration import get_default_automated_scanners
            settings["scanners"] = get_default_automated_scanners(settings)

        # Sync live next_run_at for each scanner
        for sc in settings.get("scanners", []):
            sc_id = sc.get("id")
            if sc.get("enabled"):
                next_t = get_scanner_next_run_time(sc_id)
                if next_t:
                    sc["next_run_at"] = next_t.isoformat()
            else:
                sc["next_run_at"] = None

        any_enabled = any(s.get("enabled") for s in settings.get("scanners", []))
        if not settings.get("enabled") and not any_enabled:
            settings["next_run_at"] = None
        else:
            # Overall next run time
            candidate_times = []
            for s in settings.get("scanners", []):
                if s.get("enabled") and s.get("next_run_at"):
                    try:
                        candidate_times.append(datetime.fromisoformat(s["next_run_at"].replace("Z", "+00:00")))
                    except Exception:
                        pass
            if candidate_times:
                settings["next_run_at"] = min(candidate_times).isoformat()
            else:
                legacy_next = get_next_scan_time()
                if legacy_next:
                    settings["next_run_at"] = legacy_next.isoformat()

        config.scanner_settings = settings
    else:
        from app.schemas.site_configuration import DEFAULT_SCAN_PRESETS, get_default_automated_scanners
        config.scanner_settings = {
            "presets": DEFAULT_SCAN_PRESETS,
            "scanners": get_default_automated_scanners(),
        }
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
            flag_modified(config, field)
            
    db.commit()
    db.refresh(config)

    if payload.scanner_settings is not None:
        settings = dict(config.scanner_settings or {})
        scanners = settings.get("scanners") or []

        if scanners:
            # Multi-scanner synchronization
            synced_settings = sync_all_scanner_schedules(settings)
            config.scanner_settings = synced_settings
        else:
            # Legacy fallback
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


@admin_router.post("/scanners/{scanner_id}/run")
def run_scanner_now(
    scanner_id: str,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentStaffUser,
) -> dict[str, str]:
    """Triggers an automated scanner execution immediately in background."""
    if user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    config = db.scalar(select(SiteConfiguration).limit(1))
    if not config:
        raise HTTPException(status_code=404, detail="Site configuration not found.")

    settings = dict(config.scanner_settings or {})
    scanners = list(settings.get("scanners") or [])
    scanner = next((s for s in scanners if s.get("id") == scanner_id), None)
    if not scanner and scanner_id != "default-ikman":
        raise HTTPException(status_code=404, detail=f"Scanner '{scanner_id}' not found.")

    background_tasks.add_task(run_automated_scanner, scanner_id)
    return {"message": f"Scanner '{scanner_id}' started in background."}
