import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
import structlog

from app.auth import CurrentStaffUser
from app.db.session import SessionLocal, get_db
from app.models.prospect import Prospect
from app.models.site_configuration import SiteConfiguration
from app.schemas.prospect import (
    ProspectRead,
    ProspectUpdate,
    ScanRequest,
)
from app.scraper.classifier import classify_listing_heuristics
from app.scraper.ikman_client import IkmanClient, IKMAN_BASE_URL

logger = structlog.get_logger(__name__)

admin_router = APIRouter(prefix="/admin/prospects", tags=["Admin Prospects"])
DbSession = Annotated[Session, Depends(get_db)]

# In-memory dictionary to track scan jobs
SCAN_JOBS: dict[str, dict[str, Any]] = {}


def _save_prospects_sync(ads: list[Any], request: ScanRequest) -> tuple[int, int]:
    """Synchronous function to save prospects to DB."""
    found = len(ads)
    new_count = 0
    with SessionLocal() as db:
        for ad in ads:
            stmt = select(Prospect).where(Prospect.ikman_ad_id == ad.id)
            existing = db.execute(stmt).scalar_one_or_none()
            
            if existing:
                existing.last_seen_at = datetime.now(timezone.utc)
                continue
                
            new_count += 1
            classification, confidence, reasons = classify_listing_heuristics(ad)
            
            phone_number = None
            poster_name = None
            
            # Extract pre-fetched details from the mutated ad object
            if (classification == "owner" and confidence >= request.phone_fetch_confidence_threshold) or (confidence >= request.phone_fetch_confidence_threshold):
                if hasattr(ad, "contactCard") and ad.contactCard:
                    poster_name = ad.contactCard.name
                    if ad.contactCard.phoneNumbers:
                        phone_number = str(ad.contactCard.phoneNumbers[0].get("number", ""))

            prop_type = "property"
            cat_slug = ad.category.slug if ad.category else ""
            if "land" in cat_slug: prop_type = "land"
            elif "apartments" in cat_slug: prop_type = "apartment"
            elif "houses" in cat_slug: prop_type = "house"
            
            listing_type = "sale"
            if "rentals" in cat_slug: listing_type = "rent"

            new_prospect = Prospect(
                ikman_ad_id=ad.id,
                ikman_url=f"{IKMAN_BASE_URL}/en/ad/{ad.slug}" if ad.slug else "",
                ikman_slug=ad.slug or "",
                title=ad.title or "",
                price=ad.price or "",
                location=ad.location.name if ad.location else "",
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
            
        db.commit()
    return found, new_count


async def _run_scan_job(job_id: str, request: ScanRequest) -> None:
    """Background task to run the scraper."""
    job = SCAN_JOBS[job_id]
    client = IkmanClient(delay=2.0)
    found_total = 0
    new_total = 0
    
    try:
        pages_processed = 0
        for category in request.categories:
            for page in range(1, request.pages_per_category + 1):
                if job["status"] == "failed":
                    break
                    
                job["progress"] = f"Fetching {category} (page {page}/{request.pages_per_category})"
                logger.info("scraping_page", category=category, page=page)
                
                ads = await client.fetch_listing_page(category, page=page)
                
                # To call fetch_detail inside the sync DB function, we need an async loop hook
                # We will just fetch all required details asynchronously here, before the DB block
                # to avoid mixing sync/async.
                
                # Pre-fetch details if needed
                for i, ad in enumerate(ads):
                    classification, confidence, _ = classify_listing_heuristics(ad)
                    if (classification == "owner" and confidence >= request.phone_fetch_confidence_threshold) or (confidence >= request.phone_fetch_confidence_threshold):
                        if ad.slug:
                            job["progress"] = f"Fetching details for {ad.title}"
                            detail = await client.fetch_ad_detail(ad.slug)
                            if detail:
                                ads[i] = detail

                # Now save to DB in a thread
                found, new_c = await asyncio.to_thread(_save_prospects_sync, ads, request)
                found_total += found
                new_total += new_c
                
                pages_processed += 1
                job["pages_processed"] = pages_processed
                
        job["status"] = "completed"
        job["progress"] = f"Done. Found {found_total} listings, {new_total} new."
        
    except Exception as e:
        logger.exception("scan_job_failed", error=str(e))
        job["status"] = "failed"
        job["error"] = str(e)
    finally:
        await client.close()


@admin_router.post("/scan")
def start_scan(
    request: ScanRequest, 
    background_tasks: BackgroundTasks,
    _admin: CurrentStaffUser
) -> dict[str, str]:
    job_id = str(uuid.uuid4())
    SCAN_JOBS[job_id] = {
        "status": "running",
        "progress": "Starting up...",
        "pages_processed": 0,
        "total_pages": len(request.categories) * request.pages_per_category,
        "started_at": datetime.now(timezone.utc).isoformat()
    }
    
    background_tasks.add_task(_run_scan_job, job_id, request)
    return {"job_id": job_id}


@admin_router.get("/scan/{job_id}/status")
def get_scan_status(
    job_id: str, 
    _admin: CurrentStaffUser
) -> dict[str, Any]:
    if job_id not in SCAN_JOBS:
        return {"status": "not_found"}
    return SCAN_JOBS[job_id]


@admin_router.get("", response_model=list[ProspectRead])
def list_prospects(
    db: DbSession,
    _admin: CurrentStaffUser,
    classification: str | None = None,
    status: str | None = None,
    property_type: str | None = None,
    listing_type: str | None = None
) -> Any:
    stmt = select(Prospect).order_by(Prospect.first_seen_at.desc())
    if classification:
        stmt = stmt.where(Prospect.classification == classification)
    if status:
        stmt = stmt.where(Prospect.status == status)
    if property_type:
        stmt = stmt.where(Prospect.property_type == property_type)
    if listing_type:
        stmt = stmt.where(Prospect.listing_type == listing_type)
        
    return db.execute(stmt).scalars().all()


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
