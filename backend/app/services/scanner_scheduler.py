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

def get_scanner_next_run_time(scanner_id: str) -> datetime | None:
    """Returns the next scheduled run time of a specific scanner job, if any."""
    try:
        job = scheduler.get_job(f"scanner_job_{scanner_id}")
        if job and job.next_run_time:
            return job.next_run_time
    except Exception:
        pass
    return None

def schedule_scanner_job(scanner_id: str, freq_hours: int, last_run_at_str: str | None = None) -> datetime | None:
    """Schedules an individual automated scanner with intelligent next_run_time calculation."""
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
            next_run_time = now
    else:
        next_run_time = now

    job = scheduler.add_job(
        run_automated_scanner,
        'interval',
        hours=freq_hours,
        args=[scanner_id],
        id=f"scanner_job_{scanner_id}",
        replace_existing=True,
        next_run_time=next_run_time,
        coalesce=True,
        misfire_grace_time=3600,
    )
    logger.info(
        "scanner_job.scheduled",
        scanner_id=scanner_id,
        hours=freq_hours,
        next_run=job.next_run_time.isoformat() if job.next_run_time else None
    )
    return job.next_run_time

def remove_scanner_job(scanner_id: str) -> None:
    """Removes a specific scanner job from the scheduler if present."""
    job_id = f"scanner_job_{scanner_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info("scanner_job.unscheduled", scanner_id=scanner_id)

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
            next_run_time = now
    else:
        next_run_time = now

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
    """Removes the legacy property scanner job from the scheduler if present."""
    if scheduler.get_job('property_scanner_job'):
        scheduler.remove_job('property_scanner_job')
        logger.info("property_scanner.unscheduled")

def sync_all_scanner_schedules(scanner_settings: dict) -> dict:
    """Synchronizes all automated scanners with APScheduler."""
    settings = dict(scanner_settings or {})
    scanners = list(settings.get("scanners") or [])

    if not scanners:
        # Legacy fallback
        if settings.get("enabled"):
            freq = settings.get("frequency_hours", 24)
            last_run = settings.get("last_run_at")
            next_run = schedule_property_scanner(freq, last_run)
            settings["next_run_at"] = next_run.isoformat() if next_run else None
        else:
            remove_property_scanner()
            settings["next_run_at"] = None
        return settings

    # Also remove legacy job if multi-scanners are used
    remove_property_scanner()

    earliest_next_run: datetime | None = None
    any_enabled = False

    updated_scanners = []
    for sc in scanners:
        sc_dict = dict(sc)
        sc_id = sc_dict.get("id")
        if sc_dict.get("enabled"):
            any_enabled = True
            freq = sc_dict.get("frequency_hours", 24)
            last_run = sc_dict.get("last_run_at")
            next_run = schedule_scanner_job(sc_id, freq, last_run)
            if next_run:
                sc_dict["next_run_at"] = next_run.isoformat()
                if earliest_next_run is None or next_run < earliest_next_run:
                    earliest_next_run = next_run
            else:
                sc_dict["next_run_at"] = None
        else:
            remove_scanner_job(sc_id)
            sc_dict["next_run_at"] = None
        updated_scanners.append(sc_dict)

    settings["scanners"] = updated_scanners
    settings["enabled"] = any_enabled
    settings["next_run_at"] = earliest_next_run.isoformat() if earliest_next_run else None
    return settings

def run_automated_scanner(scanner_id: str):
    """Executes a specific automated scanner instance in background."""
    logger.info("automated_scanner.run_started", scanner_id=scanner_id)
    with SessionLocal() as session:
        result = session.execute(select(SiteConfiguration).limit(1))
        config = result.scalar_one_or_none()

        if not config:
            logger.info("automated_scanner.no_config", scanner_id=scanner_id)
            return

        settings = dict(config.scanner_settings or {})
        scanners = list(settings.get("scanners") or [])
        scanner = next((s for s in scanners if s.get("id") == scanner_id), None)

        if not scanner:
            # Check legacy fallback
            if scanner_id in ("default-ikman", "property_scanner_job") and settings.get("enabled"):
                scanner = {
                    "id": scanner_id,
                    "name": "Ikman Scanner",
                    "source": "ikman",
                    "enabled": settings.get("enabled", False),
                    "frequency_hours": settings.get("frequency_hours", 24),
                    "pages_to_scan": settings.get("pages_to_scan", 5),
                    "property_types": settings.get("property_types", ["house", "apartment"]),
                }
            else:
                logger.warning("automated_scanner.not_found", scanner_id=scanner_id)
                return

        if not scanner.get("enabled"):
            logger.info("automated_scanner.disabled_in_db", scanner_id=scanner_id)
            return

        source = scanner.get("source", "ikman")
        name = scanner.get("name", f"{source.upper()} Scanner")
        pages_to_scan = scanner.get("pages_to_scan", 5)
        property_types = scanner.get("property_types", [])
        keyword = scanner.get("keyword")

        job_id = uuid.uuid4()
        new_job = ScanJob(
            id=job_id,
            source=source,
            job_type="scan",
            status="running",
            progress=f"Background {name} scan started...",
            keyword=keyword,
            created_by_name=f"Automation ({name})",
        )
        session.add(new_job)
        session.commit()

        logger.info(
            "automated_scanner.executing",
            scanner_id=scanner_id,
            source=source,
            pages=pages_to_scan,
            types=property_types,
            keyword=keyword,
        )

        categories: list[str] = []
        if source == "lpw":
            if "house" in property_types:
                categories.append("House")
            if "apartment" in property_types:
                categories.append("Apartment")
            if "land" in property_types:
                categories.append("Land")
            if "commercial" in property_types:
                categories.append("Commercial")
            if not categories:
                categories = ["House", "Apartment"]
        else:
            if "house" in property_types:
                categories.extend(["houses-for-sale", "house-rentals"])
            if "apartment" in property_types:
                categories.extend(["apartments-for-sale", "apartment-rentals"])
            if "land" in property_types:
                categories.append("land-for-sale")
            if "commercial" in property_types:
                categories.extend(["commercial-property-sale", "commercial-property-rent"])

        if not categories:
            logger.info("automated_scanner.no_categories", scanner_id=scanner_id)
            new_job.status = "failed"
            new_job.progress = "Failed: No valid property types selected."
            session.commit()
            return

        try:
            req = ScanRequest(
                source=source,
                categories=list(set(categories)),
                pages_per_category=pages_to_scan,
                keyword=keyword,
            )
            asyncio.run(_run_scan_job(str(job_id), req))
            session.refresh(new_job)
            status_text = new_job.progress or new_job.status
        except Exception as e:
            logger.exception("automated_scanner.failed", scanner_id=scanner_id, error=str(e))
            status_text = f"Failed: {e}"

        now_iso = datetime.now(timezone.utc).isoformat()
        next_time = get_scanner_next_run_time(scanner_id)
        next_time_iso = next_time.isoformat() if next_time else None

        updated_scanners = []
        for s in scanners:
            if s.get("id") == scanner_id:
                s_copy = dict(s)
                s_copy["last_run_at"] = now_iso
                s_copy["last_run_status"] = status_text
                if next_time_iso:
                    s_copy["next_run_at"] = next_time_iso
                updated_scanners.append(s_copy)
            else:
                updated_scanners.append(s)

        if not updated_scanners and scanner_id == "default-ikman":
            updated_scanners = [dict(scanner)]
            updated_scanners[0]["last_run_at"] = now_iso
            updated_scanners[0]["last_run_status"] = status_text

        settings["scanners"] = updated_scanners
        settings["last_run_at"] = now_iso
        settings["last_run_status"] = f"[{name}] {status_text}"

        config.scanner_settings = settings
        flag_modified(config, "scanner_settings")
        session.commit()

def run_property_scanner():
    """Legacy background task that performs the scanning."""
    logger.info("property_scanner.run_started")
    with SessionLocal() as session:
        result = session.execute(select(SiteConfiguration).limit(1))
        config = result.scalar_one_or_none()

        if not config:
            logger.info("property_scanner.no_config")
            return

        settings = dict(config.scanner_settings or {})
        # If modern scanners exist, run the first enabled scanner or default-ikman
        scanners = settings.get("scanners") or []
        if scanners:
            ikman_scanner = next((s for s in scanners if s.get("id") == "default-ikman" or s.get("source") == "ikman"), scanners[0])
            run_automated_scanner(ikman_scanner.get("id", "default-ikman"))
            return

        if not settings.get("enabled"):
            logger.info("property_scanner.disabled_in_db")
            return

        pages_to_scan = settings.get("pages_to_scan", 5)
        property_types = settings.get("property_types", [])

        job_id = uuid.uuid4()
        new_job = ScanJob(
            id=job_id,
            source="ikman",
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
            categories.extend(["commercial-property-sale", "commercial-property-rent"])

        if not categories:
            logger.info("property_scanner.no_categories")
            new_job.status = "failed"
            new_job.progress = "Failed: No valid property types selected."
            session.commit()
            return

        try:
            req = ScanRequest(categories=list(set(categories)), pages_per_category=pages_to_scan)
            asyncio.run(_run_scan_job(str(job_id), req))
            session.refresh(new_job)
            status_text = new_job.progress or new_job.status
        except Exception as e:
            logger.exception("property_scanner.failed", error=str(e))
            status_text = f"Failed: {e}"

        settings["last_run_at"] = datetime.now(timezone.utc).isoformat()
        settings["last_run_status"] = status_text
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
        settings = dict(config.scanner_settings)
        scanners = settings.get("scanners") or []
        if scanners:
            synced_settings = sync_all_scanner_schedules(settings)
            try:
                with SessionLocal() as session:
                    cfg = session.execute(select(SiteConfiguration).limit(1)).scalar_one_or_none()
                    if cfg:
                        cfg.scanner_settings = synced_settings
                        flag_modified(cfg, "scanner_settings")
                        session.commit()
            except Exception as e:
                logger.warning("init_scheduler.save_next_run_failed", error=str(e))
        elif settings.get("enabled"):
            freq = settings.get("frequency_hours", 24)
            last_run = settings.get("last_run_at")
            next_run = schedule_property_scanner(freq, last_run)
            if next_run:
                try:
                    with SessionLocal() as session:
                        cfg = session.execute(select(SiteConfiguration).limit(1)).scalar_one_or_none()
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
