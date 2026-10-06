"""API routes for market benchmarks and property valuation benchmarking."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session
import structlog

from app.auth import CurrentStaffUser
from app.db.session import get_db, SessionLocal
from app.models.market_benchmark import MarketBenchmark
from app.schemas.auth import StaffRole
from app.schemas.market_benchmark import (
    BenchmarkCalculationRequest,
    BenchmarkCalculationResponse,
    BenchmarkSyncRequest,
    BenchmarkSyncResponse,
    MarketBenchmarkRead,
)
from app.services.benchmark_sync import (
    calculate_market_comparison,
    run_benchmark_sync,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/market-benchmarks", tags=["market-benchmarks"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[MarketBenchmarkRead])
def list_market_benchmarks(
    db: DbSession,
    user: CurrentStaffUser,
    location: str | None = Query(None, description="Filter by location"),
    property_type: str | None = Query(None, description="house, apartment, land, commercial"),
    listing_type: str | None = Query(None, description="sale, rent"),
) -> list[MarketBenchmark]:
    """Lists stored localized benchmarks for staff reference."""
    stmt = select(MarketBenchmark)
    if location:
        stmt = stmt.where(MarketBenchmark.location.ilike(f"%{location.strip()}%"))
    if property_type:
        stmt = stmt.where(MarketBenchmark.property_type == property_type.lower().strip())
    if listing_type:
        stmt = stmt.where(MarketBenchmark.listing_type == listing_type.lower().strip())

    stmt = stmt.order_by(MarketBenchmark.location.asc(), MarketBenchmark.property_type.asc())
    return list(db.execute(stmt).scalars().all())


def _background_sync_task(target_locations: list[str] | None):
    with SessionLocal() as session:
        try:
            asyncio.run(run_benchmark_sync(session, target_locations=target_locations))
        except Exception as exc:
            logger.exception("benchmark_sync.bg_failed", error=str(exc))


@router.post("/sync", response_model=BenchmarkSyncResponse)
def trigger_benchmark_sync(
    payload: BenchmarkSyncRequest,
    background_tasks: BackgroundTasks,
    user: CurrentStaffUser,
    db: DbSession,
) -> BenchmarkSyncResponse:
    """Manually triggers a benchmark sync (Admin or Root staff only)."""
    if user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Root permissions required to trigger benchmark synchronization."
        )

    if payload.background:
        background_tasks.add_task(_background_sync_task, payload.locations)
        return BenchmarkSyncResponse(
            message="Market benchmark synchronization started in background.",
            job_started=True,
        )
    else:
        # Run synchronously (blocking)
        try:
            result = asyncio.run(run_benchmark_sync(db, target_locations=payload.locations))
            return BenchmarkSyncResponse(
                message=f"Sync completed: {result['synced_benchmarks']} rates updated across {result['locations_scanned']} locations.",
                job_started=True,
            )
        except Exception as exc:
            logger.exception("benchmark_sync.manual_failed", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Benchmark sync failed: {exc}",
            )


@router.post("/calculate", response_model=BenchmarkCalculationResponse)
def evaluate_market_price(
    payload: BenchmarkCalculationRequest,
    db: DbSession,
) -> BenchmarkCalculationResponse:
    """Evaluates whether a given price is above, at, or below market rate."""
    result = calculate_market_comparison(
        session=db,
        location=payload.location,
        property_type=payload.property_type,
        listing_type=payload.listing_type,
        price=payload.price,
        floor_area_sqft=payload.floor_area_sqft,
        land_size_perches=payload.land_size_perches,
    )
    return BenchmarkCalculationResponse(**result)
