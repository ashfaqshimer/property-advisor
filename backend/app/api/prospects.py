import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Annotated, Any

import csv
import io
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import delete, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import structlog

from app.auth import CurrentStaffUser
from app.db.session import SessionLocal, get_db
from app.models.prospect import Prospect
from app.schemas.auth import StaffRole
from app.models.scan_job import ScanJob
from app.models.site_configuration import SiteConfiguration
from app.schemas.prospect import (
    ProspectRead,
    ProspectUpdate,
    ScanRequest,
    ProspectList,
    ScanJobRead,
    ScanJobList,
)
from app.scraper.classifier import classify_listing_heuristics
from app.scraper.ikman_client import IkmanClient, IKMAN_BASE_URL
from app.scraper.location_extractor import extract_suburb
from app.agent.client import get_gemini_extractor_client
from app.schemas.extractor import ExtractedPropertyDraft, GeminiPropertyExtraction
from app.services.geocoding import geocode_location
import json

logger = structlog.get_logger(__name__)

admin_router = APIRouter(prefix="/admin/prospects", tags=["Admin Prospects"])
DbSession = Annotated[Session, Depends(get_db)]


def _enrich_location_from_detail(db: Session, prospect: Prospect, detail: Any) -> bool:
    """Enriches prospect suburb, location and geocodes from Ikman ad detail payload."""
    changed = False
    if not detail or not detail.location:
        return False

    loc_obj = detail.location
    suburb_name = None
    parent_district = None

    if isinstance(loc_obj, dict):
        suburb_name = loc_obj.get("name")
        parent = loc_obj.get("parent")
        if isinstance(parent, dict):
            parent_district = parent.get("name")
    elif hasattr(loc_obj, "name"):
        suburb_name = loc_obj.name
        if hasattr(loc_obj, "parent") and loc_obj.parent:
            parent_district = loc_obj.parent.get("name") if isinstance(loc_obj.parent, dict) else getattr(loc_obj.parent, "name", None)

    if suburb_name:
        if prospect.suburb != suburb_name or prospect.suburb_source != "ikman_detail":
            prospect.suburb = suburb_name
            prospect.suburb_source = "ikman_detail"
            changed = True

        if parent_district and prospect.location != parent_district:
            prospect.location = parent_district
            changed = True

        # Re-geocode with verified suburb
        target = f"{suburb_name}, {prospect.location}" if prospect.location else suburb_name
        lat, lng = geocode_location(db, target)
        if lat is not None and (prospect.latitude != lat or prospect.longitude != lng):
            prospect.latitude = lat
            prospect.longitude = lng
            changed = True

    return changed


def _update_job_status(
    job_id: str,
    status: str,
    progress: str,
    error: str | None = None,
    pages_scanned: int | None = None,
    total_pages: int | None = None,
    total_found: int | None = None,
    new_count: int | None = None,
    updated_count: int | None = None,
    filtered_count: int | None = None,
    duration_seconds: float | None = None,
) -> None:
    with SessionLocal() as db:
        try:
            job = db.get(ScanJob, uuid.UUID(job_id))
            if job:
                job.status = status
                job.progress = progress
                if error is not None:
                    job.error = error
                if pages_scanned is not None:
                    job.pages_scanned = pages_scanned
                if total_pages is not None:
                    job.total_pages = total_pages
                if total_found is not None:
                    job.total_found = total_found
                if new_count is not None:
                    job.new_count = new_count
                if updated_count is not None:
                    job.updated_count = updated_count
                if filtered_count is not None:
                    job.filtered_count = filtered_count
                if duration_seconds is not None:
                    job.duration_seconds = duration_seconds
                db.commit()
        except ValueError:
            pass  # invalid uuid


def is_location_relevant(ad: Any, keyword: str, extracted_suburb: str | None) -> bool:
    """Checks if the listing title, slug, or extracted suburb matches the target location keyword."""
    if not keyword or not keyword.strip():
        return True

    kw_norm = keyword.strip().lower()

    # 1. Match against extracted suburb (and canonical forms)
    if extracted_suburb:
        sub_norm = extracted_suburb.strip().lower()
        if kw_norm in sub_norm or sub_norm in kw_norm:
            return True
        from app.scraper.location_extractor import CANONICAL_MAP
        canon_sub = CANONICAL_MAP.get(sub_norm, sub_norm).lower()
        canon_kw = CANONICAL_MAP.get(kw_norm, kw_norm).lower()
        if canon_kw in canon_sub or canon_sub in canon_kw:
            return True

    # 2. Match against title
    title_lower = (getattr(ad, "title", "") or "").lower()
    if kw_norm in title_lower:
        return True

    # 3. Match against slug
    slug_lower = (getattr(ad, "slug", "") or "").lower()
    kw_slug = kw_norm.replace(" ", "-")
    if kw_slug in slug_lower or kw_norm in slug_lower:
        return True

    return False


def _save_prospects_sync(
    ads: list[Any],
    request: ScanRequest,
    scan_job_id: uuid.UUID | None = None
) -> tuple[int, int, int, int]:
    """Synchronous function to save prospects to DB. Returns (found, new_count, known_count, filtered_count)"""
    found = len(ads)
    new_count = 0
    known_count = 0
    filtered_count = 0
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
                
            loc_str = ""
            if isinstance(ad.location, str):
                loc_str = ad.location
            elif ad.location and hasattr(ad.location, "name"):
                loc_str = ad.location.name or ""

            suburb = extract_suburb(title=ad.title or "", slug=ad.slug or "", district=loc_str)
            suburb_source = "extracted" if suburb else None

            is_discarded = False
            discard_reason = None

            # Relevance check for scoped searches
            if request.keyword and request.strict_location:
                if not is_location_relevant(ad, request.keyword, suburb):
                    is_discarded = True
                    discard_reason = "location_mismatch"
                    filtered_count += 1

            if not is_discarded:
                new_count += 1

            classification, confidence, reasons = classify_listing_heuristics(ad)
            
            if classification == "broker" and not is_discarded:
                new_count -= 1
                continue
                        
            phone_number = None
            poster_name = None
            
            # Note: Phone numbers are fetched explicitly via the phone fetch API,
            # not during the initial scan phase.

            prop_type = "property"
            cat_slug = ""
            if ad.category:
                cat_slug = (ad.category.slug or ad.category.name or "").lower()
            if "land" in cat_slug: prop_type = "land"
            elif "apartments" in cat_slug: prop_type = "apartment"
            elif "houses" in cat_slug: prop_type = "house"
            elif "commercial" in cat_slug: prop_type = "commercial"
            
            listing_type = "sale"
            if "rentals" in cat_slug: listing_type = "rent"

            geo_target = f"{suburb}, {loc_str}" if suburb and loc_str else (suburb or loc_str)
            lat, lng = None, None
            if geo_target:
                lat, lng = geocode_location(db, geo_target)

            new_prospect = Prospect(
                ikman_ad_id=ad.id,
                ikman_url=f"{IKMAN_BASE_URL}/en/ad/{ad.slug}" if ad.slug else "",
                ikman_slug=ad.slug or "",
                title=ad.title or "",
                price=ad.price or "",
                location=loc_str,
                suburb=suburb,
                suburb_source=suburb_source,
                latitude=lat,
                longitude=lng,
                property_type=prop_type,
                listing_type=listing_type,
                poster_name=poster_name,
                phone_number=phone_number,
                classification=classification,
                confidence=confidence,
                classification_reasons=reasons,
                classification_method="heuristic",
                status="discarded" if is_discarded else "new",
                discard_reason=discard_reason,
                is_member=ad.isMember,
                is_auth_dealer=ad.isAuthDealer,
                membership_level=ad.membershipLevel,
                shop_name=ad.shopName,
                first_scan_job_id=scan_job_id,
            )
            db.add(new_prospect)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                # Race condition: another concurrent task just inserted this ad!
                if not is_discarded:
                    new_count -= 1
                else:
                    filtered_count -= 1
                known_count += 1
                existing_after = db.execute(select(Prospect).where(Prospect.ikman_ad_id == ad.id)).scalar_one_or_none()
                if existing_after:
                    existing_after.last_seen_at = datetime.now(timezone.utc)
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()
            
    return found, new_count, known_count, filtered_count


async def _run_scan_job(job_id: str, request: ScanRequest) -> None:
    """Background task to run the scraper with concurrency and early exit."""
    client = IkmanClient(delay=1.0)
    start_time = asyncio.get_event_loop().time()
    found_total = 0
    new_total = 0
    known_total = 0
    filtered_total = 0
    pages_processed = 0
    total_target_pages = 0
    
    scan_job_uuid: uuid.UUID | None = None
    try:
        scan_job_uuid = uuid.UUID(job_id)
    except ValueError:
        pass

    semaphore = asyncio.Semaphore(3)

    # Determine categories to scan based on scoped keyword / category filter
    target_categories = request.categories
    if request.keyword and request.keyword.strip():
        cat_map = {
            "all": ["property"],
            "land": ["land"],
            "lands": ["land"],
            "houses": ["houses"],
            "house": ["houses"],
            "apartments": ["apartments"],
            "apartment": ["apartments"],
            "commercial": ["commercial-property"],
            "commercial-property": ["commercial-property"],
        }
        prop_cat = (request.property_category or "all").lower().strip()
        target_categories = cat_map.get(prop_cat, ["property"])

    try:
        for category in target_categories:
            kw_label = f" for '{request.keyword}'" if request.keyword else ""
            
            # Fetch page 1 first to read exact total listings & pagination count from ikman
            first_ads, first_meta = await client.fetch_listing_page_with_meta(category, page=1, query=request.keyword)
            if not first_ads:
                continue

            total_ads = first_meta.get("total", 0) if isinstance(first_meta, dict) else 0
            detected_pages = (total_ads + 24) // 25 if total_ads > 0 else 1

            if request.scan_all or not request.pages_per_category:
                category_target_pages = detected_pages
            else:
                category_target_pages = min(request.pages_per_category, detected_pages)

            total_target_pages += category_target_pages

            _update_job_status(
                job_id,
                "running",
                f"Scanning {category}{kw_label} (page 1/{category_target_pages}) [Total {total_ads} available]...",
                pages_scanned=pages_processed,
                total_pages=total_target_pages,
            )

            # Save page 1
            f1, n1, k1, fl1 = await asyncio.to_thread(_save_prospects_sync, first_ads, request, scan_job_uuid)
            found_total += f1
            new_total += n1
            known_total += k1
            filtered_total += fl1
            pages_processed += 1

            if category_target_pages <= 1:
                continue

            # Process remaining pages in chunks of 3 with a polite delay between chunks
            chunk_size = 3
            early_exit = False
            for chunk_start in range(2, category_target_pages + 1, chunk_size):
                # Polite rate-limit delay between chunks
                await asyncio.sleep(1.5)

                with SessionLocal() as db:
                    current_job = db.get(ScanJob, uuid.UUID(job_id))
                    if not current_job or current_job.status in ("failed", "cancelled"):
                        early_exit = True
                        break

                chunk_end = min(chunk_start + chunk_size, category_target_pages + 1)
                
                async def _fetch_page(p: int) -> tuple[int, int, int, int]:
                    async with semaphore:
                        _update_job_status(
                            job_id,
                            "running",
                            f"Fetching {category}{kw_label} (page {p}/{category_target_pages})...",
                            pages_scanned=pages_processed,
                            total_pages=total_target_pages,
                            total_found=found_total,
                            new_count=new_total,
                            updated_count=known_total,
                            filtered_count=filtered_total,
                        )
                        logger.info("scraping_page", category=category, page=p, keyword=request.keyword)
                        ads, _ = await client.fetch_listing_page_with_meta(category, page=p, query=request.keyword)
                        if not ads:
                            return 0, 0, 0, 0
                        return await asyncio.to_thread(_save_prospects_sync, ads, request, scan_job_uuid)

                tasks = [_fetch_page(p) for p in range(chunk_start, chunk_end)]
                results = await asyncio.gather(*tasks)

                chunk_all_known = True
                for (found, new_c, known_c, fl_c) in results:
                    found_total += found
                    new_total += new_c
                    known_total += known_c
                    filtered_total += fl_c
                    pages_processed += 1
                    if found > 0 and known_c < found:
                        chunk_all_known = False

                # Early exit if all ads in this chunk are already known in DB
                if chunk_all_known and any(found > 0 for (found, new_c, known_c, fl_c) in results):
                    logger.info("early_exit_triggered", category=category, at_page=chunk_end - 1)
                    _update_job_status(
                        job_id,
                        "running",
                        f"Early exit for {category}: all ads known up to page {chunk_end - 1}."
                    )
                    break

                # If an empty chunk is encountered, stop scanning this category
                if all(found == 0 for (found, new_c, known_c, fl_c) in results):
                    break

            if early_exit:
                break
                
        elapsed = round(asyncio.get_event_loop().time() - start_time, 2)
        kw_msg = f" for '{request.keyword}'" if request.keyword else ""
        _update_job_status(
            job_id,
            "completed",
            f"Done{kw_msg}. Scanned {pages_processed} pages, found {found_total} listings ({new_total} new, {filtered_total} filtered).",
            pages_scanned=pages_processed,
            total_pages=total_target_pages,
            total_found=found_total,
            new_count=new_total,
            updated_count=known_total,
            filtered_count=filtered_total,
            duration_seconds=elapsed,
        )
        
    except Exception as e:
        logger.exception("scan_job_failed", error=str(e))
        error_msg = str(e)
        if "[SQL:" in error_msg:
            error_msg = error_msg.split("[SQL:")[0].strip()
        elapsed = round(asyncio.get_event_loop().time() - start_time, 2)
        _update_job_status(
            job_id,
            "failed",
            f"Failed: {error_msg}",
            error=error_msg,
            pages_scanned=pages_processed,
            total_pages=total_target_pages,
            total_found=found_total,
            new_count=new_total,
            updated_count=known_total,
            filtered_count=filtered_total,
            duration_seconds=elapsed,
        )
    finally:
        await client.close()


@admin_router.post("/scan")
def start_scan(
    request: ScanRequest, 
    background_tasks: BackgroundTasks,
    db: DbSession,
    _admin: CurrentStaffUser
) -> dict[str, str]:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    job_id = str(uuid.uuid4())
    new_job = ScanJob(
        id=uuid.UUID(job_id),
        job_type="scan",
        status="running",
        progress=f"Starting scan{' for ' + request.keyword if request.keyword else ''}...",
        keyword=request.keyword,
        property_category=request.property_category,
        created_by_id=_admin.id,
        created_by_name=_admin.name
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
) -> dict[str, Any]:
    stmt = select(ScanJob).where(ScanJob.status == "running")
    running_jobs = db.execute(stmt).scalars().all()
    
    active: dict[str, Any] = {
        "scan": None, 
        "phone_fetch": None,
        "last_scan_at": None,
        "last_phone_fetch_at": None
    }
    
    timeout_threshold = datetime.now(timezone.utc) - timedelta(hours=1)
    has_timeouts = False
    
    for job in running_jobs:
        # Check if job is stuck
        job_time = job.updated_at if job.updated_at else job.created_at
        # Assuming job_time is timezone aware. If naive, might need adjustment, but SQLA DateTime(timezone=True) usually returns aware.
        if job_time.tzinfo is None:
            job_time = job_time.replace(tzinfo=timezone.utc)
            
        if job_time < timeout_threshold:
            job.status = "failed"
            job.error = "Job timed out (running for >1 hour)"
            job.progress = "Failed: Server crash or timeout."
            has_timeouts = True
            continue
            
        if job.job_type == "scan":
            active["scan"] = str(job.id)
        elif job.job_type == "phone_fetch":
            active["phone_fetch"] = str(job.id)
            
    if has_timeouts:
        db.commit()
            
    last_scan = db.execute(
        select(ScanJob)
        .where(ScanJob.job_type == "scan", ScanJob.status == "completed")
        .order_by(ScanJob.updated_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    
    last_phone = db.execute(
        select(ScanJob)
        .where(ScanJob.job_type == "phone_fetch", ScanJob.status == "completed")
        .order_by(ScanJob.updated_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    
    if last_scan:
        active["last_scan_at"] = last_scan.updated_at.isoformat()
        if _admin.role in (StaffRole.ROOT, StaffRole.ADMIN):
            active["last_scan_by"] = last_scan.created_by_name
    if last_phone:
        active["last_phone_fetch_at"] = last_phone.updated_at.isoformat()
        if _admin.role in (StaffRole.ROOT, StaffRole.ADMIN):
            active["last_phone_fetch_by"] = last_phone.created_by_name
            
    return active


async def _run_phone_fetch_job(job_id: str, target_scan_job_id: uuid.UUID | None = None) -> None:
    client = IkmanClient(delay=1.0)
    start_time = asyncio.get_event_loop().time()
    
    try:
        with SessionLocal() as db:
            stmt = select(Prospect).where(
                Prospect.classification == "owner",
                Prospect.phone_number == None
            )
            if target_scan_job_id:
                stmt = stmt.where(Prospect.first_scan_job_id == target_scan_job_id)

            prospects = db.execute(stmt).scalars().all()
            if not prospects:
                elapsed = round(asyncio.get_event_loop().time() - start_time, 2)
                _update_job_status(
                    job_id,
                    "completed",
                    "No owners found missing phone numbers.",
                    total_found=0,
                    new_count=0,
                    duration_seconds=elapsed,
                )
                return
                
            processed = 0
            found_phones = 0
            for prospect in prospects:
                with SessionLocal() as check_db:
                    current_job = check_db.get(ScanJob, uuid.UUID(job_id))
                    if not current_job or current_job.status in ("failed", "cancelled"):
                        break
                    
                _update_job_status(
                    job_id,
                    "running",
                    f"Fetching phone for {prospect.title} ({processed}/{len(prospects)})",
                    total_found=len(prospects),
                    pages_scanned=processed,
                    new_count=found_phones,
                )
                if prospect.ikman_slug:
                    detail = await client.fetch_ad_detail(prospect.ikman_slug)
                    if detail:
                        loc_updated = _enrich_location_from_detail(db, prospect, detail)
                        if detail.contactCard and detail.contactCard.phoneNumbers:
                            prospect.poster_name = detail.contactCard.name
                            prospect.phone_number = str(detail.contactCard.phoneNumbers[0].get("number", ""))
                            found_phones += 1
                            db.commit()
                        elif loc_updated:
                            db.commit()
                
                processed += 1
                
        elapsed = round(asyncio.get_event_loop().time() - start_time, 2)
        _update_job_status(
            job_id,
            "completed",
            f"Done. Found {found_phones} phone numbers out of {processed} prospects.",
            total_found=processed,
            pages_scanned=processed,
            new_count=found_phones,
            duration_seconds=elapsed,
        )
        
    except Exception as e:
        logger.exception("phone_job_failed", error=str(e))
        elapsed = round(asyncio.get_event_loop().time() - start_time, 2)
        _update_job_status(
            job_id,
            "failed",
            f"Failed: {str(e)}",
            error=str(e),
            duration_seconds=elapsed,
        )
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
        progress="Starting up...",
        created_by_id=_admin.id,
        created_by_name=_admin.name
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


@admin_router.get("/scans", response_model=ScanJobList)
def list_scan_jobs(
    db: DbSession,
    _admin: CurrentStaffUser,
    job_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> Any:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    stmt = select(ScanJob)
    if job_type:
        stmt = stmt.where(ScanJob.job_type == job_type)
    
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    stmt = stmt.order_by(ScanJob.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = db.execute(stmt).scalars().all()
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@admin_router.get("/scans/{job_id}", response_model=ScanJobRead)
def get_scan_job_detail(
    job_id: uuid.UUID,
    db: DbSession,
    _admin: CurrentStaffUser,
) -> Any:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    job = db.get(ScanJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job


@admin_router.get("/scans/{job_id}/prospects", response_model=ProspectList)
def list_scan_job_prospects(
    job_id: uuid.UUID,
    db: DbSession,
    _admin: CurrentStaffUser,
    status: str | None = None,
    property_type: str | None = None,
    listing_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> Any:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    stmt = select(Prospect).where(Prospect.first_scan_job_id == job_id)
    if status:
        stmt = stmt.where(Prospect.status == status)
    if property_type:
        stmt = stmt.where(Prospect.property_type == property_type)
    if listing_type:
        stmt = stmt.where(Prospect.listing_type == listing_type)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    stmt = stmt.order_by(Prospect.first_seen_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = db.execute(stmt).scalars().all()
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@admin_router.post("/scans/{job_id}/fetch-phones")
def start_scan_job_phone_fetch(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: DbSession,
    _admin: CurrentStaffUser,
) -> dict[str, str]:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    parent_job = db.get(ScanJob, job_id)
    if not parent_job:
        raise HTTPException(status_code=404, detail="Scan job not found")

    new_phone_job_id = str(uuid.uuid4())
    new_job = ScanJob(
        id=uuid.UUID(new_phone_job_id),
        job_type="phone_fetch",
        status="running",
        progress=f"Fetching phones for scan {str(job_id)[:8]}...",
        keyword=parent_job.keyword,
        property_category=parent_job.property_category,
        created_by_id=_admin.id,
        created_by_name=_admin.name
    )
    db.add(new_job)
    db.commit()

    background_tasks.add_task(_run_phone_fetch_job, new_phone_job_id, target_scan_job_id=job_id)
    return {"job_id": new_phone_job_id}


@admin_router.get("/scans/{job_id}/export")
def export_scan_prospects_csv(
    job_id: uuid.UUID,
    db: DbSession,
    _admin: CurrentStaffUser,
) -> Response:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Admin or Root access required")

    job = db.get(ScanJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")

    stmt = select(Prospect).where(Prospect.first_scan_job_id == job_id).order_by(Prospect.first_seen_at.desc())
    prospects = db.execute(stmt).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Title",
        "Price",
        "Property Type",
        "Listing Type",
        "Location",
        "Suburb",
        "Phone Number",
        "Poster Name",
        "Classification",
        "Confidence",
        "Status",
        "Ikman URL",
        "Discovered At",
    ])

    for p in prospects:
        writer.writerow([
            str(p.id),
            p.title or "",
            p.price or "",
            p.property_type or "",
            p.listing_type or "",
            p.location or "",
            p.suburb or "",
            p.phone_number or "",
            p.poster_name or "",
            p.classification or "",
            f"{p.confidence:.2f}" if p.confidence is not None else "",
            p.status or "",
            p.ikman_url or "",
            p.first_seen_at.isoformat() if p.first_seen_at else "",
        ])

    csv_content = output.getvalue()
    slug_name = job.keyword.replace(" ", "_") if job.keyword else "all"
    filename = f"scan_{slug_name}_{str(job.id)[:8]}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


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
        if detail:
            loc_updated = _enrich_location_from_detail(db, prospect, detail)
            if detail.contactCard and detail.contactCard.phoneNumbers:
                prospect.poster_name = detail.contactCard.name
                prospect.phone_number = str(detail.contactCard.phoneNumbers[0].get("number", ""))
                db.commit()
                db.refresh(prospect)
            elif loc_updated:
                db.commit()
                db.refresh(prospect)
            else:
                raise HTTPException(status_code=404, detail="Phone number not found on ikman")
        else:
            raise HTTPException(status_code=404, detail="Ad detail not found on ikman")
    finally:
        await client.close()
        
    return prospect


@admin_router.post("/{id}/convert-draft", response_model=ExtractedPropertyDraft)
async def generate_property_draft(
    id: uuid.UUID,
    db: DbSession,
    _admin: CurrentStaffUser
) -> Any:
    if _admin.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only root and admin users can extract properties")

    prospect = db.get(Prospect, id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
        
    if not prospect.ikman_slug:
        raise HTTPException(status_code=400, detail="Prospect has no ikman slug to fetch")
        
    client = IkmanClient(delay=0)
    try:
        detail = await client.fetch_ad_detail(prospect.ikman_slug)
        if not detail:
            raise HTTPException(status_code=404, detail="Ad detail not found on ikman")
            
        updated_contact = _enrich_location_from_detail(db, prospect, detail)
        if detail.contactCard:
            if detail.contactCard.name and prospect.poster_name != detail.contactCard.name:
                prospect.poster_name = detail.contactCard.name
                updated_contact = True
            
            new_phone = None
            if detail.contactCard.phoneNumbers:
                new_phone = str(detail.contactCard.phoneNumbers[0].get("number", ""))
            
            if new_phone and prospect.phone_number != new_phone:
                prospect.phone_number = new_phone
                updated_contact = True
                
        if updated_contact:
            db.commit()
            
    finally:
        await client.close()
    # Serialize the detail payload to JSON string
    raw_data = detail.model_dump_json(exclude_none=True)
    
    prompt = f"""
    Extract a structured real estate property listing from this raw data.
    The data is scraped from an online classifieds site.
    
    Raw Data:
    {raw_data}
    
    Instructions:
    1. Provide a professional, clean title.
    2. Write a clear, grammatically correct description. Remove boilerplate terms like "No brokers", "Price negotiable", "Contact for details".
    3. The price should be extracted as a clean float (e.g., 150000.0). Ignore currencies, just the number.
    4. Determine if the price is per perch (usually indicated by 'per perch' or 'pp').
    5. Determine the property_type (house, apartment, land, commercial) and listing_type (sale, rent).
    6. Extract beds, baths, land size (perches), floor area (sqft), year built, parking spaces, road access width.
    7. Determine furnishing status (unfurnished, semi_furnished, fully_furnished) if applicable.
    8. Check for specific features: maid's room/storage, maid's toilet, and whether it's a gated community.
    9. Extract a list of amenities if mentioned (e.g., ["ac", "hot_water"]).
    10. Provide a short alt text for the main image based on the property type.
    """
    
    extractor = get_gemini_extractor_client()
    try:
        raw_draft = extractor.generate_structured(prompt=prompt, schema=GeminiPropertyExtraction)
        
        amenities_dict = None
        if raw_draft.amenities:
            amenities_dict = {a: True for a in raw_draft.amenities}
            
        draft_dict = raw_draft.model_dump()
        draft_dict["amenities"] = amenities_dict
        
        draft_dict["contact_name"] = prospect.poster_name
        draft_dict["contact_phone"] = prospect.phone_number
        draft_dict["contact_type"] = prospect.classification
        
        draft_dict["source_platform"] = "ikman.lk"
        draft_dict["source_url"] = prospect.ikman_url
        draft_dict["source_id"] = prospect.ikman_ad_id
        draft_dict["prospect_id"] = prospect.id
        
        return ExtractedPropertyDraft(**draft_dict)
    except Exception as e:
        logger.exception("property_extraction_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")


@admin_router.get("", response_model=ProspectList)
def list_prospects(
    db: DbSession,
    _admin: CurrentStaffUser,
    status: str | None = None,
    property_type: str | None = None,
    listing_type: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> Any:
    stmt = select(Prospect).where(Prospect.classification == "owner")

    if status:
        stmt = stmt.where(Prospect.status == status)
    else:
        stmt = stmt.where(Prospect.status != "discarded")

    if property_type:
        stmt = stmt.where(Prospect.property_type == property_type)
    if listing_type:
        stmt = stmt.where(Prospect.listing_type == listing_type)

    if q:
        term = q.strip()
        is_postgres = db.bind.dialect.name == "postgresql" if db.bind else False
        if is_postgres:
            # Trigram fuzzy search: use the pg_trgm `%` similarity operator across
            # location, suburb, title, and poster_name. Fallback to ILIKE so that short
            # tokens (< 3 chars) which trgm ignores still return substring matches.
            trgm_match = (
                Prospect.location.op("%")(term)
                | Prospect.suburb.op("%")(term)
                | Prospect.title.op("%")(term)
                | Prospect.poster_name.op("%")(term)
            )
            ilike_match = (
                Prospect.location.ilike(f"%{term}%")
                | Prospect.suburb.ilike(f"%{term}%")
                | Prospect.title.ilike(f"%{term}%")
                | Prospect.poster_name.ilike(f"%{term}%")
            )
            stmt = stmt.where(trgm_match | ilike_match)

            similarity_score = (
                func.greatest(
                    func.similarity(Prospect.location, term),
                    func.coalesce(func.similarity(Prospect.suburb, term), 0.0),
                    func.similarity(Prospect.title, term),
                    func.coalesce(func.similarity(Prospect.poster_name, term), 0.0),
                )
            )
            stmt = stmt.order_by(similarity_score.desc(), Prospect.first_seen_at.desc())
        else:
            # SQLite fallback for test environment
            ilike_match = (
                Prospect.location.ilike(f"%{term}%")
                | Prospect.suburb.ilike(f"%{term}%")
                | Prospect.title.ilike(f"%{term}%")
                | Prospect.poster_name.ilike(f"%{term}%")
            )
            stmt = stmt.where(ilike_match).order_by(Prospect.first_seen_at.desc())

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar_one()
        items = db.execute(stmt.limit(100)).scalars().all()
        return {
            "items": items,
            "total": total,
            "page": 1,
            "page_size": 100,
            "total_pages": 1,
        }

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
        old_status = prospect.status
        prospect.status = prospect_update.status
        if old_status == "discarded" and prospect.status != "discarded":
            prospect.discard_reason = None
            if prospect.first_scan_job_id:
                scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                if scan_job:
                    scan_job.new_count = (scan_job.new_count or 0) + 1
                    scan_job.filtered_count = max(0, (scan_job.filtered_count or 0) - 1)
        elif old_status != "discarded" and prospect.status == "discarded":
            if prospect.first_scan_job_id:
                scan_job = db.get(ScanJob, prospect.first_scan_job_id)
                if scan_job:
                    scan_job.new_count = max(0, (scan_job.new_count or 0) - 1)
                    scan_job.filtered_count = (scan_job.filtered_count or 0) + 1

    if prospect_update.discard_reason is not None:
        prospect.discard_reason = prospect_update.discard_reason
        
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
