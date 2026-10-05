"""
Market valuation service for Sri Lankan suburbs and areas.

Calculates trimmed medians, averages, price ranges, and unit rates
(per perch for land, per sqft for houses/apartments), integrating:
1. Active curated properties
2. Scraped listings (prospects)
3. CBSL DS Division macro baselines & suburb benchmarks
4. Realization negotiation discount (standard 10% in Sri Lanka)
"""
from __future__ import annotations

import statistics
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.property import ListingType, Property, PropertyStatus, PropertyType
from app.models.prospect import Prospect
from app.models.suburb import Suburb
from app.services.price_parser import parse_lkr_price

logger = structlog.get_logger(__name__)

# Sri Lankan real estate asking prices carry a standard 5% - 15% negotiation discount.
# We apply a 10% realization factor to convert asking rates to realistic transaction values.
REALIZATION_DISCOUNT_FACTOR = Decimal("0.90")


def _trimmed_median(values: list[Decimal | float | int]) -> float | None:
    """Computes median after discarding extreme outliers if sample size is sufficient."""
    if not values:
        return None
    sorted_vals = sorted(float(v) for v in values if v is not None and v > 0)
    if not sorted_vals:
        return None
    n = len(sorted_vals)
    if n >= 6:
        # Trim top and bottom 10%
        trim_k = max(1, int(n * 0.10))
        trimmed = sorted_vals[trim_k : n - trim_k]
        if trimmed:
            return round(statistics.median(trimmed), 2)
    return round(statistics.median(sorted_vals), 2)


def get_suburb_by_query(db: Session, location_query: str) -> Suburb | None:
    """
    Finds a matching Suburb entity by name, slug, or alias.
    """
    cleaned = location_query.strip().lower()
    if not cleaned:
        return None

    # 1. Exact match on slug or name
    stmt = select(Suburb).where(
        or_(
            Suburb.slug == cleaned.replace(" ", "-"),
            Suburb.name.ilike(cleaned),
        )
    )
    sub = db.execute(stmt).scalar_one_or_none()
    if sub:
        return sub

    # 2. Check all active suburbs for alias or substring match
    all_subs = db.execute(select(Suburb).where(Suburb.is_active.is_(True))).scalars().all()
    for s in all_subs:
        if s.name.lower() in cleaned or cleaned in s.name.lower():
            return s
        for alias in s.aliases:
            if alias.lower() == cleaned or alias.lower() in cleaned or cleaned in alias.lower():
                return s

    return None


def calculate_suburb_market_value(
    db: Session,
    location_query: str,
    property_type: str | None = None,
    listing_type: str = "sale",
) -> dict[str, Any]:
    """
    Calculates detailed market valuation statistics for a suburb or area.
    """
    suburb_entity = get_suburb_by_query(db, location_query)
    canonical_name = suburb_entity.name if suburb_entity else location_query.title()
    district = suburb_entity.district if suburb_entity else "Colombo"
    tier = suburb_entity.tier if suburb_entity else "General Suburb"
    ds_division = suburb_entity.ds_division if suburb_entity else None

    # Candidate location tokens for matching properties/prospects
    search_tokens = [canonical_name.lower()]
    if suburb_entity:
        search_tokens.append(suburb_entity.slug.lower())
        search_tokens.extend([a.lower() for a in suburb_entity.aliases])

    # 1. Aggregate from internal Property listings
    prop_filter = [
        Property.status.in_([PropertyStatus.AVAILABLE, PropertyStatus.SOLD, PropertyStatus.UNDER_OFFER]),
        Property.listing_type == (ListingType.SALE if listing_type == "sale" else ListingType.RENT),
    ]
    if property_type:
        pt_clean = property_type.lower()
        if pt_clean in ("house", "apartment", "land", "commercial"):
            prop_filter.append(Property.property_type == PropertyType(pt_clean))

    prop_rows = db.execute(select(Property).where(*prop_filter)).scalars().all()
    matched_properties = []
    for p in prop_rows:
        loc = (p.location or "").lower()
        if any(token in loc for token in search_tokens):
            matched_properties.append(p)

    # 2. Aggregate from Prospect listings
    prospect_filter = [
        Prospect.status.notin_(["discarded"]),
        Prospect.listing_type.in_([listing_type, f"for_{listing_type}"]),
    ]
    if property_type:
        prospect_filter.append(Prospect.property_type == property_type.lower())

    prospect_rows = db.execute(select(Prospect).where(*prospect_filter)).scalars().all()
    matched_prospects = []
    for pr in prospect_rows:
        sub_name = (pr.suburb or "").lower()
        loc_name = (pr.location or "").lower()
        title_name = (pr.title or "").lower()
        if (
            any(token == sub_name for token in search_tokens)
            or any(token in loc_name for token in search_tokens)
            or any(token in title_name for token in search_tokens)
        ):
            matched_prospects.append(pr)

    # Collect numbers
    raw_prices: list[Decimal] = []
    land_rates_per_perch: list[Decimal] = []
    sqft_rates: list[Decimal] = []

    # From Properties
    for p in matched_properties:
        if p.price and p.price > 0:
            if p.property_type == PropertyType.LAND and p.is_price_per_perch:
                land_rates_per_perch.append(p.price)
                if p.land_size_perches:
                    raw_prices.append(p.price * p.land_size_perches)
            else:
                raw_prices.append(p.price)
                if p.property_type == PropertyType.LAND and p.land_size_perches and p.land_size_perches > 0:
                    land_rates_per_perch.append(p.price / p.land_size_perches)
                if p.floor_area_sqft and p.floor_area_sqft > 0:
                    sqft_rates.append(p.price / Decimal(p.floor_area_sqft))

    # From Prospects
    for pr in matched_prospects:
        p_val = pr.price_numeric
        is_ppp = pr.is_price_per_perch
        if not p_val and pr.price:
            p_val, is_ppp = parse_lkr_price(pr.price)

        if p_val and p_val > 0:
            if pr.property_type == "land" and is_ppp:
                land_rates_per_perch.append(p_val)
                if pr.land_size_perches:
                    raw_prices.append(p_val * pr.land_size_perches)
            else:
                raw_prices.append(p_val)
                if pr.property_type == "land" and pr.land_size_perches and pr.land_size_perches > 0:
                    land_rates_per_perch.append(p_val / pr.land_size_perches)
                if pr.floor_area_sqft and pr.floor_area_sqft > 0:
                    sqft_rates.append(p_val / Decimal(pr.floor_area_sqft))

    sample_count = len(matched_properties) + len(matched_prospects)
    has_sufficient_samples = sample_count >= 5

    # Compute stats
    median_asking_price = _trimmed_median(raw_prices)
    median_land_per_perch = _trimmed_median(land_rates_per_perch)
    median_price_per_sqft = _trimmed_median(sqft_rates)

    # Fallback to CBSL / Suburb baseline if internal samples are scarce
    baseline_land_min = float(suburb_entity.baseline_land_perch_min) if suburb_entity and suburb_entity.baseline_land_perch_min else None
    baseline_land_max = float(suburb_entity.baseline_land_perch_max) if suburb_entity and suburb_entity.baseline_land_perch_max else None
    baseline_sqft_min = float(suburb_entity.baseline_apartment_sqft_min) if suburb_entity and suburb_entity.baseline_apartment_sqft_min else None
    baseline_sqft_max = float(suburb_entity.baseline_apartment_sqft_max) if suburb_entity and suburb_entity.baseline_apartment_sqft_max else None

    # Recommended market rate (accounting for ~10% negotiation discount)
    realized_median_price = (
        round(median_asking_price * float(REALIZATION_DISCOUNT_FACTOR), 2)
        if median_asking_price
        else None
    )
    realized_land_per_perch = (
        round(median_land_per_perch * float(REALIZATION_DISCOUNT_FACTOR), 2)
        if median_land_per_perch
        else None
    )

    # Determine confidence level
    if sample_count >= 15:
        confidence = "high"
    elif sample_count >= 5:
        confidence = "medium"
    elif suburb_entity is not None:
        confidence = "benchmark_supported"
    else:
        confidence = "indicative"

    return {
        "suburb": canonical_name,
        "district": district,
        "ds_division": ds_division,
        "tier": tier,
        "property_type": property_type or "all",
        "listing_type": listing_type,
        "sample_size": sample_count,
        "has_live_data": sample_count > 0,
        "confidence": confidence,
        "negotiation_discount_percent": 10,
        "stats": {
            "median_asking_price_lkr": median_asking_price,
            "estimated_realized_price_lkr": realized_median_price,
            "price_per_perch_lkr": {
                "asking_median": median_land_per_perch,
                "realized_estimate": realized_land_per_perch,
                "benchmark_range": [baseline_land_min, baseline_land_max] if baseline_land_min else None,
            },
            "price_per_sqft_lkr": {
                "asking_median": median_price_per_sqft,
                "benchmark_range": [baseline_sqft_min, baseline_sqft_max] if baseline_sqft_min else None,
            },
        },
    }
