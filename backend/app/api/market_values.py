"""
Suburb and Area Market Valuation API routes.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.suburb import Suburb
from app.services.market_valuation import (
    KNOWN_SUB_AREAS,
    calculate_suburb_market_value,
)
from app.services.suburb_seeds import seed_suburbs_data

router = APIRouter(prefix="/market-values", tags=["market-values"])
admin_router = APIRouter(prefix="/admin/suburbs", tags=["admin-suburbs"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("/suburbs")
def list_supported_suburbs(db: DbSession, district: str | None = None) -> list[dict[str, Any]]:
    """Lists all canonical suburbs with their districts, CBSL DS divisions, and known micro-areas."""
    stmt = select(Suburb).where(Suburb.is_active.is_(True)).order_by(Suburb.district, Suburb.name)
    if district:
        stmt = stmt.where(Suburb.district.ilike(district.strip()))
    suburbs = db.execute(stmt).scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "slug": s.slug,
            "district": s.district,
            "ds_division": s.ds_division,
            "aliases": s.aliases,
            "known_sub_areas": KNOWN_SUB_AREAS.get(s.slug.replace("-", " "), []),
            "baseline_land_perch_range": [
                float(s.baseline_land_perch_min) if s.baseline_land_perch_min else None,
                float(s.baseline_land_perch_max) if s.baseline_land_perch_max else None,
            ],
            "baseline_apartment_sqft_range": [
                float(s.baseline_apartment_sqft_min) if s.baseline_apartment_sqft_min else None,
                float(s.baseline_apartment_sqft_max) if s.baseline_apartment_sqft_max else None,
            ],
        }
        for s in suburbs
    ]


@router.get("/estimate")
def get_market_value_estimate(
    db: DbSession,
    suburb: str = Query(..., description="Suburb or area name, e.g. 'Rajagiriya', 'Colombo 7', 'Dehiwala'"),
    sub_area: str | None = Query(None, description="Optional micro-area, e.g. 'Attidiya', 'Kalubowila', 'Nedimala'"),
    property_type: str | None = Query(None, description="house, apartment, land, commercial"),
    listing_type: str = Query("sale", description="sale or rent"),
    max_days: int = Query(90, description="Listing sourcing lookback window in days (default 90)"),
    unit_type: str | None = Query(None, description="Optional unit type ('per_perch' or 'per_sqft')"),
) -> dict[str, Any]:
    """
    Returns estimated market value, per-unit price percentiles (per perch/sqft),
    sourcing breakdown, sub-area comparisons, and prospect grading thresholds.
    """
    return calculate_suburb_market_value(
        db=db,
        location_query=suburb,
        sub_area_filter=sub_area,
        property_type=property_type,
        listing_type=listing_type,
        max_days=max_days,
        unit_type=unit_type,
    )


@router.get("/trends")
def get_market_trends(
    db: DbSession,
    suburb: str = Query(..., description="Suburb or area name, e.g. 'Dehiwala', 'Rajagiriya'"),
    sub_area: str | None = Query(None, description="Optional micro-area, e.g. 'Attidiya'"),
    property_type: str | None = Query("land", description="land, house, apartment, commercial"),
    listing_type: str = Query("sale", description="sale or rent"),
    months_back: int = Query(6, ge=1, le=24, description="Months of historical trend data"),
    unit_type: str | None = Query(None, description="Optional unit type ('per_perch' or 'per_sqft')"),
) -> dict[str, Any]:
    """
    Returns monthly median unit rate trends and month-over-month percentage changes.
    """
    from app.services.market_valuation import calculate_monthly_trends
    return calculate_monthly_trends(
        db=db,
        location_query=suburb,
        sub_area_filter=sub_area,
        property_type=property_type,
        listing_type=listing_type,
        months_back=months_back,
        unit_type=unit_type,
    )


@admin_router.post("/seed")
def seed_suburbs(db: DbSession) -> dict[str, Any]:
    """Seeds or refreshes the baseline suburb and CBSL DS Division benchmark catalog."""
    seeded_count = seed_suburbs_data(db)
    return {"status": "ok", "seeded_count": seeded_count}
