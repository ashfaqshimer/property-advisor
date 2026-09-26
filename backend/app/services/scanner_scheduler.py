import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.site_configuration import SiteConfiguration
from app.models.scan_job import ScanJob
import uuid
import asyncio
from app.api.prospects import _run_scan_job
from app.schemas.prospect import ScanRequest

logger = structlog.get_logger()

# Global scheduler instance
scheduler = BackgroundScheduler()

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
        config.scanner_settings = settings
        flag_modified(config, "scanner_settings")
        session.commit()


def init_scheduler():
    """Initializes the scheduler based on current DB config."""
    with SessionLocal() as session:
        result = session.execute(select(SiteConfiguration).limit(1))
        config = result.scalar_one_or_none()
    
    if config and config.scanner_settings:
        settings = config.scanner_settings
        if settings.get("enabled"):
            freq = settings.get("frequency_hours", 24)
            scheduler.add_job(
                run_property_scanner,
                'interval',
                hours=freq,
                id='property_scanner_job',
                replace_existing=True
            )
            logger.info("property_scanner.scheduled", hours=freq)

    scheduler.start()

def shutdown_scheduler():
    """Shuts down the scheduler."""
    scheduler.shutdown()
