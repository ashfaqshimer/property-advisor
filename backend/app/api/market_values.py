"""
Suburb and Area Market Valuation API routes.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.suburb import Suburb
from app.services.market_valuation import calculate_suburb_market_value
from app.services.suburb_seeds import seed_suburbs_data

router = APIRouter(prefix="/market-values", tags=["market-values"])
admin_router = APIRouter(prefix="/admin/suburbs", tags=["admin-suburbs"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("/suburbs")
def list_supported_suburbs(db: DbSession, district: str | None = None) -> list[dict[str, Any]]:
    """Lists all canonical suburbs with their tiers, districts, and CBSL DS divisions."""
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
            "tier": s.tier,
            "aliases": s.aliases,
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
    suburb: str = Query(..., description="Suburb or area name, e.g. 'Rajagiriya', 'Colombo 7', 'Nugegoda'"),
    property_type: str | None = Query(None, description="house, apartment, land, commercial"),
    listing_type: str = Query("sale", description="sale or rent"),
) -> dict[str, Any]:
    """
    Returns estimated market value, asking medians, per-perch/sqft ranges,
    and realization discounts for a given suburb or area.
    """
    return calculate_suburb_market_value(
        db=db,
        location_query=suburb,
        property_type=property_type,
        listing_type=listing_type,
    )


@admin_router.post("/seed")
def seed_suburbs(db: DbSession) -> dict[str, Any]:
    """Seeds or refreshes the baseline suburb and CBSL DS Division benchmark catalog."""
    seeded_count = seed_suburbs_data(db)
    return {"status": "ok", "seeded_count": seeded_count}
