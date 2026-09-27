import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime, timezone, timedelta

from app.db.session import SessionLocal
from app.models.site_configuration import SiteConfiguration
from app.models.scan_job import ScanJob
from sqlalchemy.exc import OperationalError
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type
import uuid
import asyncio
from app.api.prospects import _run_scan_job
from app.schemas.prospect import ScanRequest

logger = structlog.get_logger()

# Global scheduler instance
scheduler = BackgroundScheduler()

def get_next_scan_time() -> datetime | None:
    """Returns the next scheduled run time of the scanner job, if any."""
    try:
        job = scheduler.get_job('property_scanner_job')
        if job and job.next_run_time:
            return job.next_run_time
    except Exception:
        pass
    return None

def schedule_property_scanner(freq_hours: int, last_run_at_str: str | None = None) -> datetime | None:
    """Schedule the background property scanner with intelligent next_run_time calculation."""
    now = datetime.now(timezone.utc)
    next_run_time = None

    if last_run_at_str:
        try:
            last_run = datetime.fromisoformat(last_run_at_str.replace("Z", "+00:00"))
            if last_run.tzinfo is None:
                last_run = last_run.replace(tzinfo=timezone.utc)
            target = last_run + timedelta(hours=freq_hours)
            if target <= now:
                next_run_time = now
            else:
                next_run_time = target
        except Exception:
            next_run_time = now + timedelta(hours=freq_hours)
    else:
        next_run_time = now + timedelta(hours=freq_hours)

    job = scheduler.add_job(
        run_property_scanner,
        'interval',
        hours=freq_hours,
        id='property_scanner_job',
        replace_existing=True,
        next_run_time=next_run_time,
        coalesce=True,
        misfire_grace_time=3600,
    )
    logger.info(
        "property_scanner.scheduled",
        hours=freq_hours,
        next_run=job.next_run_time.isoformat() if job.next_run_time else None
    )
    return job.next_run_time

def remove_property_scanner():
    """Removes the property scanner job from the scheduler if present."""
    if scheduler.get_job('property_scanner_job'):
        scheduler.remove_job('property_scanner_job')
        logger.info("property_scanner.unscheduled")

def run_property_scanner():
    """The background task that performs the scanning."""
    logger.info("property_scanner.run_started")
    # Fetch latest settings inside the job, just in case
    with SessionLocal() as session:
        result = session.execute(select(SiteConfiguration).limit(1))
        config = result.scalar_one_or_none()
        
        if not config:
            logger.info("property_scanner.no_config")
            return
            
        settings = config.scanner_settings
        if not settings.get("enabled"):
            logger.info("property_scanner.disabled_in_db")
            return

        pages_to_scan = settings.get("pages_to_scan", 5)
        property_types = settings.get("property_types", [])

        job_id = uuid.uuid4()
        new_job = ScanJob(
            id=job_id,
            job_type="scan",
            status="running",
            progress="Background scan started...",
            created_by_name="Cron"
        )
        session.add(new_job)
        session.commit()

        logger.info(
            "property_scanner.executing", 
            pages=pages_to_scan, 
            types=property_types
        )
        
        categories = []
        if "house" in property_types:
            categories.extend(["houses-for-sale", "house-rentals"])
        if "apartment" in property_types:
            categories.extend(["apartments-for-sale", "apartment-rentals"])
        if "land" in property_types:
            categories.append("land-for-sale")
        if "commercial" in property_types:
            categories.extend(["commercial-property-for-sale", "commercial-property-to-rent"])
            
        if not categories:
            logger.info("property_scanner.no_categories")
            new_job.status = "failed"
            new_job.progress = "Failed: No valid property types selected."
            session.commit()
            return
            
        req = ScanRequest(categories=list(set(categories)), pages_per_category=pages_to_scan)
        asyncio.run(_run_scan_job(str(job_id), req))
        
        # Refresh the job to get its final status updated by _run_scan_job
        session.refresh(new_job)
        
        settings["last_run_at"] = datetime.now(timezone.utc).isoformat()
        settings["last_run_status"] = new_job.progress
        next_time = get_next_scan_time()
        if next_time:
            settings["next_run_at"] = next_time.isoformat()
        config.scanner_settings = settings
        flag_modified(config, "scanner_settings")
        session.commit()


@retry(
    stop=stop_after_attempt(5),
    wait=wait_fixed(2),
    retry=retry_if_exception_type(OperationalError)
)
def _get_config_with_retry():
    with SessionLocal() as session:
        result = session.execute(select(SiteConfiguration).limit(1))
        return result.scalar_one_or_none()

def init_scheduler():
    """Initializes the scheduler based on current DB config."""
    try:
        config = _get_config_with_retry()
    except Exception as e:
        logger.error("init_scheduler.db_failed", error=str(e))
        config = None
    
    if config and config.scanner_settings:
        settings = config.scanner_settings
        if settings.get("enabled"):
            freq = settings.get("frequency_hours", 24)
            last_run = settings.get("last_run_at")
            next_run = schedule_property_scanner(freq, last_run)
            if next_run:
                try:
                    with SessionLocal() as session:
                        result = session.execute(select(SiteConfiguration).limit(1))
                        cfg = result.scalar_one_or_none()
                        if cfg:
                            s = dict(cfg.scanner_settings or {})
                            s["next_run_at"] = next_run.isoformat()
                            cfg.scanner_settings = s
                            flag_modified(cfg, "scanner_settings")
                            session.commit()
                except Exception as e:
                    logger.warning("init_scheduler.save_next_run_failed", error=str(e))

    if not scheduler.running:
        scheduler.start()

def shutdown_scheduler():
    """Shuts down the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
