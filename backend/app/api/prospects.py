import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import delete, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import structlog

from app.auth import CurrentStaffUser
from app.db.session import SessionLocal, get_db
from app.models.prospect import Prospect
from app.models.scan_job import ScanJob
from app.models.site_configuration import SiteConfiguration
from app.schemas.prospect import (
    ProspectRead,
    ProspectUpdate,
    ScanRequest,
    ProspectList,
)
from app.scraper.classifier import classify_listing_heuristics
from app.scraper.ikman_client import IkmanClient, IKMAN_BASE_URL

logger = structlog.get_logger(__name__)

admin_router = APIRouter(prefix="/admin/prospects", tags=["Admin Prospects"])
DbSession = Annotated[Session, Depends(get_db)]


def _update_job_status(job_id: str, status: str, progress: str, error: str | None = None) -> None:
    with SessionLocal() as db:
        try:
            job = db.get(ScanJob, uuid.UUID(job_id))
            if job:
                job.status = status
                job.progress = progress
                if error is not None:
                    job.error = error
                db.commit()
        except ValueError:
            pass  # invalid uuid


def _save_prospects_sync(ads: list[Any], request: ScanRequest) -> tuple[int, int, int]:
    """Synchronous function to save prospects to DB. Returns (found, new_count, known_count)"""
    found = len(ads)
    new_count = 0
    known_count = 0
    with SessionLocal() as db:
        for ad in ads:
            stmt = select(Prospect).where(Prospect.ikman_ad_id == ad.id)
            existing = db.execute(stmt).scalar_one_or_none()
            
            if existing:
                existing.last_seen_at = datetime.now(timezone.utc)
                known_count += 1
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                continue
                
            new_count += 1
            classification, confidence, reasons = classify_listing_heuristics(ad)
            
            if classification == "broker":
                new_count -= 1
                continue
                        
            phone_number = None
            poster_name = None
            
            # Note: Phone numbers are now fetched explicitly via the phone fetch API,
            # not during the initial scan phase.

            prop_type = "property"
            cat_slug = ""
            if ad.category:
                cat_slug = (ad.category.slug or ad.category.name or "").lower()
            if "land" in cat_slug: prop_type = "land"
            elif "apartments" in cat_slug: prop_type = "apartment"
            elif "houses" in cat_slug: prop_type = "house"
            
            listing_type = "sale"
            if "rentals" in cat_slug: listing_type = "rent"

            loc_str = ""
            if isinstance(ad.location, str):
                loc_str = ad.location
            elif ad.location and hasattr(ad.location, "name"):
                loc_str = ad.location.name or ""

            new_prospect = Prospect(
                ikman_ad_id=ad.id,
                ikman_url=f"{IKMAN_BASE_URL}/en/ad/{ad.slug}" if ad.slug else "",
                ikman_slug=ad.slug or "",
                title=ad.title or "",
                price=ad.price or "",
                location=loc_str,
                property_type=prop_type,
                listing_type=listing_type,
                poster_name=poster_name,
                phone_number=phone_number,
                classification=classification,
                confidence=confidence,
                classification_reasons=reasons,
                classification_method="heuristic",
                status="new",
                is_member=ad.isMember,
                is_auth_dealer=ad.isAuthDealer,
                membership_level=ad.membershipLevel,
                shop_name=ad.shopName
            )
            db.add(new_prospect)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                # Race condition: another concurrent task just inserted this ad!
                new_count -= 1
                known_count += 1
                existing_after = db.execute(select(Prospect).where(Prospect.ikman_ad_id == ad.id)).scalar_one_or_none()
                if existing_after:
                    existing_after.last_seen_at = datetime.now(timezone.utc)
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
            
    return found, new_count, known_count


async def _run_scan_job(job_id: str, request: ScanRequest) -> None:
    """Background task to run the scraper with concurrency and early exit."""
    client = IkmanClient(delay=1.0)
    found_total = 0
    new_total = 0
    
    semaphore = asyncio.Semaphore(3)
    
    async def _fetch_and_save(category: str, page: int) -> tuple[int, int, int]:
        async with semaphore:
            _update_job_status(job_id, "running", f"Fetching {category} (page {page}/{request.pages_per_category})")
            logger.info("scraping_page", category=category, page=page)
            ads = await client.fetch_listing_page(category, page=page)
            if not ads:
                return 0, 0, 0
            
            # No detail fetching during the scan phase anymore!
            # Just directly save to DB in a thread
            return await asyncio.to_thread(_save_prospects_sync, ads, request)

    try:
        pages_processed = 0
        for category in request.categories:
            chunk_size = 3
            for chunk_start in range(1, request.pages_per_category + 1, chunk_size):
                with SessionLocal() as db:
                    current_job = db.get(ScanJob, uuid.UUID(job_id))
                    if not current_job or current_job.status == "failed":
                        break
                    
                chunk_end = min(chunk_start + chunk_size, request.pages_per_category + 1)
                
                tasks = []
                for page in range(chunk_start, chunk_end):
                    tasks.append(_fetch_and_save(category, page))
                    
                results = await asyncio.gather(*tasks)
                
                chunk_all_known = True
                for (found, new_c, known_c) in results:
                    found_total += found
                    new_total += new_c
                    pages_processed += 1
                    
                    if found > 0 and known_c < found:
                        chunk_all_known = False
                        
                # Early Exit logic
                if chunk_all_known and any(found > 0 for (found, new_c, known_c) in results):
                    logger.info("early_exit_triggered", category=category, at_page=chunk_end-1)
                    _update_job_status(job_id, "running", f"Early exit for {category}: all ads known up to page {chunk_end-1}.")
                    break
                
        _update_job_status(job_id, "completed", f"Done. Found {found_total} listings, {new_total} new.")
        
    except Exception as e:
        logger.exception("scan_job_failed", error=str(e))
        error_msg = str(e)
        if "[SQL:" in error_msg:
            error_msg = error_msg.split("[SQL:")[0].strip()
        _update_job_status(job_id, "failed", f"Failed: {error_msg}", error=error_msg)
    finally:
        await client.close()


@admin_router.post("/scan")
def start_scan(
    request: ScanRequest, 
    background_tasks: BackgroundTasks,
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, str]:
    job_id = str(uuid.uuid4())
    new_job = ScanJob(
        id=uuid.UUID(job_id),
        job_type="scan",
        status="running",
        progress="Starting up..."
    )
    db.add(new_job)
    db.commit()
    
    background_tasks.add_task(_run_scan_job, job_id, request)
    return {"job_id": job_id}


@admin_router.get("/scan/{job_id}/status")
def get_scan_status(
    job_id: str, 
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, Any]:
    try:
        job = db.get(ScanJob, uuid.UUID(job_id))
        if not job or job.job_type != "scan":
            return {"status": "not_found"}
        return {"status": job.status, "progress": job.progress, "error": job.error}
    except ValueError:
        return {"status": "not_found"}


@admin_router.get("/scan/active")
def get_active_jobs(
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, str | None]:
    stmt = select(ScanJob).where(ScanJob.status == "running")
    running_jobs = db.execute(stmt).scalars().all()
    
    active: dict[str, str | None] = {"scan": None, "phone_fetch": None}
    for job in running_jobs:
        if job.job_type == "scan":
            active["scan"] = str(job.id)
        elif job.job_type == "phone_fetch":
            active["phone_fetch"] = str(job.id)
            
    return active


async def _run_phone_fetch_job(job_id: str) -> None:
    client = IkmanClient(delay=1.0)
    
    try:
        with SessionLocal() as db:
            stmt = select(Prospect).where(
                Prospect.classification == "owner",
                Prospect.phone_number == None
            )
            prospects = db.execute(stmt).scalars().all()
            if not prospects:
                _update_job_status(job_id, "completed", "No owners found missing phone numbers.")
                return
                
            processed = 0
            found_phones = 0
            for prospect in prospects:
                with SessionLocal() as check_db:
                    current_job = check_db.get(ScanJob, uuid.UUID(job_id))
                    if not current_job or current_job.status == "failed":
                        break
                    
                _update_job_status(job_id, "running", f"Fetching phone for {prospect.title} ({processed}/{len(prospects)})")
                if prospect.ikman_slug:
                    detail = await client.fetch_ad_detail(prospect.ikman_slug)
                    if detail and detail.contactCard and detail.contactCard.phoneNumbers:
                        prospect.poster_name = detail.contactCard.name
                        prospect.phone_number = str(detail.contactCard.phoneNumbers[0].get("number", ""))
                        found_phones += 1
                        
                        # Commit incrementally
                        db.commit()
                
                processed += 1
                
        _update_job_status(job_id, "completed", f"Done. Found {found_phones} phone numbers out of {processed} prospects.")
        
    except Exception as e:
        logger.exception("phone_job_failed", error=str(e))
        _update_job_status(job_id, "failed", f"Failed: {str(e)}", error=str(e))
    finally:
        await client.close()


@admin_router.post("/scan/phones")
def start_bulk_phone_fetch(
    background_tasks: BackgroundTasks,
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, str]:
    job_id = str(uuid.uuid4())
    new_job = ScanJob(
        id=uuid.UUID(job_id),
        job_type="phone_fetch",
        status="running",
        progress="Starting up..."
    )
    db.add(new_job)
    db.commit()
    
    background_tasks.add_task(_run_phone_fetch_job, job_id)
    return {"job_id": job_id}


@admin_router.get("/scan/phones/{job_id}/status")
def get_phone_fetch_status(
    job_id: str, 
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, Any]:
    try:
        job = db.get(ScanJob, uuid.UUID(job_id))
        if not job or job.job_type != "phone_fetch":
            return {"status": "not_found"}
        return {"status": job.status, "progress": job.progress, "error": job.error}
    except ValueError:
        return {"status": "not_found"}


@admin_router.post("/{id}/fetch-phone", response_model=ProspectRead)
async def fetch_single_prospect_phone(
    id: uuid.UUID,
    db: DbSession,
    _admin: CurrentStaffUser
) -> Any:
    prospect = db.get(Prospect, id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
        
    if not prospect.ikman_slug:
        raise HTTPException(status_code=400, detail="Prospect has no ikman slug to fetch")
        
    client = IkmanClient(delay=0) # Single manual fetch, no delay needed
    try:
        detail = await client.fetch_ad_detail(prospect.ikman_slug)
        if detail and detail.contactCard and detail.contactCard.phoneNumbers:
            prospect.poster_name = detail.contactCard.name
            prospect.phone_number = str(detail.contactCard.phoneNumbers[0].get("number", ""))
            db.commit()
            db.refresh(prospect)
        else:
            raise HTTPException(status_code=404, detail="Phone number not found on ikman")
    finally:
        await client.close()
        
    return prospect


@admin_router.get("", response_model=ProspectList)
def list_prospects(
    db: DbSession,
    _admin: CurrentStaffUser,
    status: str | None = None,
    property_type: str | None = None,
    listing_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> Any:
    stmt = select(Prospect).where(Prospect.classification == "owner")
    
    if status:
        stmt = stmt.where(Prospect.status == status)
    if property_type:
        stmt = stmt.where(Prospect.property_type == property_type)
    if listing_type:
        stmt = stmt.where(Prospect.listing_type == listing_type)
        
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()
    
    stmt = stmt.order_by(Prospect.first_seen_at.desc())
        
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    
    items = db.execute(stmt).scalars().all()
    
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@admin_router.patch("/{id}", response_model=ProspectRead)
def update_prospect(
    id: uuid.UUID,
    prospect_update: ProspectUpdate,
    db: DbSession,
    _admin: CurrentStaffUser
) -> Any:
    prospect = db.get(Prospect, id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
        
    if prospect_update.status is not None:
        prospect.status = prospect_update.status
        
    db.commit()
    db.refresh(prospect)
    return prospect


@admin_router.delete("/purge")
def purge_old_prospects(
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, Any]:
    config = db.execute(select(SiteConfiguration).limit(1)).scalar_one_or_none()
    retention_days = config.prospect_retention_days if config else 30
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
    stmt = delete(Prospect).where(Prospect.last_seen_at < cutoff_date)
    result = db.execute(stmt)
    db.commit()
    
    return {"status": "ok", "deleted_count": result.rowcount, "retention_days": retention_days}
