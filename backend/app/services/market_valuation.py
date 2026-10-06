"""
Market valuation service for Sri Lankan suburbs and areas.

Calculates percentile ranges, per-unit rates (per perch for land/houses,
per sqft for apartments/commercial), dynamic sub-area extraction,
sourcing breakdown, and prospect pricing grading thresholds.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import re
import statistics
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

# Known micro-areas and prominent roads per major Colombo suburb
KNOWN_SUB_AREAS: dict[str, list[str]] = {
    "dehiwala": [
        "Attidiya", "Kalubowila", "Nedimala", "Kawdana", "Waidya Road",
        "Hill Street", "Galle Road", "Marine Drive", "Bellanthara",
        "Anderson Road", "Karagampitiya", "Vanderwert Place", "Station Road",
    ],
    "colombo 1": ["Fort", "Chatham Street", "York Street", "Janadhipathi Mawatha"],
    "colombo 2": ["Slave Island", "Union Place", "Kompanna Veediya", "Hyde Park", "Vauxhall Street"],
    "colombo 3": ["Kollupitiya", "Galle Road", "Duplication Road", "Bagatalle Road", "Turret Road", "Dharmapala Mawatha"],
    "colombo 4": ["Bambalapitiya", "Galle Road", "Duplication Road", "Marine Drive", "Dickmans Road", "Bullers Road"],
    "colombo 5": ["Havelock Town", "Thimbirigasyaya", "Kirulapone", "Isipathana", "Elvitigala Mawatha", "Park Road", "Fife Road"],
    "colombo 6": ["Wellawatte", "Pamankada", "Marine Drive", "Hampden Lane", "Ramakrishna Road", "Mayura Place"],
    "colombo 7": ["Cinnamon Gardens", "Torrington", "Ward Place", "Rosmead Place", "Gregory's Road", "Horton Place", "Barnes Place", "Independence Square"],
    "rajagiriya": ["Nawala Road", "Obeysekerapura", "Madinnagoda", "Welikada", "Kalapaluwawa", "Buthgamuwa", "Royal Gardens"],
    "battaramulla": ["Pelawatte", "Thalangama", "Akuregoda", "Koswatte", "Denzil Kobbekaduwa", "Wickramasinghapura"],
    "nugegoda": ["Mirihana", "Kohuwala", "Embuldeniya", "Delkanda", "Pagoda", "Stanley Thilakarathne", "Jambugasmulla", "Gansabha"],
    "mount lavinia": ["Templers Road", "Hotel Road", "Mount Beach", "Galle Road", "Siripala Road", "St. Rita's"],
    "moratuwa": ["Rawatawatte", "Moratumulla", "Egoda Uyana", "Katubedda", "Lunawa", "Uyana", "Idama"],
    "kotte": ["Beddagana", "Ethul Kotte", "Pita Kotte", "Madiwela", "Pagoda", "Bangarawatte"],
    "nawala": ["Koswatte", "School Lane", "Nawala Junction", "Rajagiriya Road", "Open University"],
    "kottawa": ["Makumbura", "Pannipitiya Road", "Rukmalgama", "Malabe Road", "Liyanagoda"],
    "malabe": ["Thalahena", "Kaduwela Road", "Athurugiriya Road", "Chandrika Kumaratunga Mawatha", "Pittugala"],
    "maharagama": ["Pamunuwa", "Arawwala", "Godigamuwa", "Pathiragoda", "Navinna"],
}


def _percentiles(values: list[Decimal | float | int]) -> dict[str, float | None]:
    """Computes Min, 25th percentile (Entry), Median, 75th percentile (Premium), and Max."""
    if not values:
        return {"min": None, "p25": None, "median": None, "p75": None, "max": None}
    sorted_vals = sorted(float(v) for v in values if v is not None and v > 0)
    if not sorted_vals:
        return {"min": None, "p25": None, "median": None, "p75": None, "max": None}

    n = len(sorted_vals)
    min_val = round(sorted_vals[0], 2)
    max_val = round(sorted_vals[-1], 2)

    if n == 1:
        v = round(sorted_vals[0], 2)
        return {"min": v, "p25": v, "median": v, "p75": v, "max": v}
    elif n < 4:
        med = round(statistics.median(sorted_vals), 2)
        return {"min": min_val, "p25": min_val, "median": med, "p75": max_val, "max": max_val}
    else:
        # Quantiles (inclusive method for accurate quartiles on small samples)
        quantiles = statistics.quantiles(sorted_vals, n=4, method="inclusive")
        return {
            "min": min_val,
            "p25": round(quantiles[0], 2),
            "median": round(quantiles[1], 2),
            "p75": round(quantiles[2], 2),
            "max": max_val,
        }


def extract_sub_area(title: str, location: str, suburb_name: str) -> str:
    """
    Identifies or extracts a micro-area from listing title and location.
    Checks known sub-areas first, then scans for common Sri Lankan address patterns.
    """
    suburb_key = suburb_name.lower().replace("-", " ")
    known_list = KNOWN_SUB_AREAS.get(suburb_key, [])

    combined_text = f"{title} {location}".lower()

    # 1. Check known sub-areas
    for area in known_list:
        if area.lower() in combined_text:
            return area

    # 2. Check for patterns like "in <Area>, <Suburb>" or "at <Area>, <Suburb>"
    first_suburb_token = suburb_name.split()[0].lower()
    match = re.search(
        r"\b(?:in|at)\s+([a-zA-Z\s]{3,25})(?:,|\s+in|\s+near|\s+off)?\s*" + re.escape(first_suburb_token),
        combined_text,
        re.IGNORECASE,
    )
    if match:
        extracted = match.group(1).strip().title()
        if extracted.lower() not in ("sale", "rent", "land", "house", "apartment", "prime", "valuable", "luxury"):
            return extracted

    # 3. Check for "<Name> Road" or "<Name> Mawatha" or "<Name> Lane"
    road_match = re.search(
        r"\b([a-zA-Z]{3,20}\s+(?:road|mawatha|lane|avenue|place|street|drive))\b",
        title,
        re.IGNORECASE,
    )
    if road_match:
        return road_match.group(1).strip().title()

    return f"Central {suburb_name.title()}"


def get_suburb_by_query(db: Session, location_query: str) -> tuple[Suburb | None, str | None]:
    """
    Finds a matching Suburb entity and any detected sub-area.
    Returns (Suburb, detected_sub_area).
    """
    cleaned = location_query.strip().lower()
    if not cleaned:
        return None, None

    # Check if query matches a known sub-area directly (e.g. "Attidiya" -> Dehiwala, "Kalubowila" -> Dehiwala)
    for parent_suburb_slug, sub_areas in KNOWN_SUB_AREAS.items():
        for area in sub_areas:
            if area.lower() == cleaned:
                # Find parent suburb entity
                parent_sub = db.execute(
                    select(Suburb).where(
                        or_(
                            Suburb.slug == parent_suburb_slug.replace(" ", "-"),
                            Suburb.name.ilike(parent_suburb_slug),
                        )
                    )
                ).scalar_one_or_none()
                if parent_sub:
                    return parent_sub, area

    # 1. Exact match on slug or name
    stmt = select(Suburb).where(
        or_(
            Suburb.slug == cleaned.replace(" ", "-"),
            Suburb.name.ilike(cleaned),
        )
    )
    sub = db.execute(stmt).scalar_one_or_none()
    if sub:
        return sub, None

    # 2. Check all active suburbs for alias or substring match
    all_subs = db.execute(select(Suburb).where(Suburb.is_active.is_(True))).scalars().all()
    for s in all_subs:
        if s.name.lower() in cleaned or cleaned in s.name.lower():
            return s, None
        for alias in s.aliases:
            if alias.lower() == cleaned or alias.lower() in cleaned or cleaned in alias.lower():
                return s, None

    return None, None


def _calculate_grading_thresholds(median_rate: float | None) -> dict[str, float | None]:
    """
    Computes prospect valuation grades:
    - Underpriced / High Yield: > 15% below market median
    - Fair Value Band: +/- 15% of market median
    - Overpriced / High Negotiation: > 15% above market median
    """
    if not median_rate or median_rate <= 0:
        return {
            "underpriced_max": None,
            "fair_value_min": None,
            "fair_value_max": None,
            "overpriced_min": None,
        }
    return {
        "underpriced_max": round(median_rate * 0.85, 2),
        "fair_value_min": round(median_rate * 0.85, 2),
        "fair_value_max": round(median_rate * 1.15, 2),
        "overpriced_min": round(median_rate * 1.15, 2),
    }


def _format_lkr_short(val: float | None) -> str:
    if val is None:
        return "—"
    if val >= 1_000_000:
        m = val / 1_000_000
        formatted = f"{m:.2f}".rstrip("0").rstrip(".") if m < 100 else f"{m:.1f}".rstrip("0").rstrip(".")
        return f"LKR {formatted}M"
    if val >= 1_000:
        k = val / 1_000
        formatted = f"{k:.1f}".rstrip("0").rstrip(".") if k < 10 else f"{k:.0f}"
        return f"LKR {formatted}K"
    return f"LKR {val:,.0f}"


def calculate_suburb_market_value(
    db: Session,
    location_query: str,
    sub_area_filter: str | None = None,
    property_type: str | None = None,
    listing_type: str = "sale",
    max_days: int = 90,
) -> dict[str, Any]:
    """
    Calculates detailed, micro-area aware market valuation statistics.
    Focuses on per-unit pricing (per perch for land/houses, per sqft for apartments),
    source provenance transparency, and grading thresholds.
    """
    suburb_entity, detected_sub_area = get_suburb_by_query(db, location_query)
    target_sub_area = sub_area_filter or detected_sub_area
    canonical_name = suburb_entity.name if suburb_entity else location_query.title()
    district = suburb_entity.district if suburb_entity else "Colombo"
    ds_division = suburb_entity.ds_division if suburb_entity else None

    # Search tokens for matching properties/prospects
    search_tokens = [canonical_name.lower()]
    if suburb_entity:
        search_tokens.append(suburb_entity.slug.lower())
        search_tokens.extend([a.lower() for a in suburb_entity.aliases])

    # 1. Query Internal Property listings
    prop_filter = [
        Property.status.in_([PropertyStatus.AVAILABLE, PropertyStatus.SOLD, PropertyStatus.UNDER_OFFER]),
        Property.listing_type == (ListingType.SALE if listing_type == "sale" else ListingType.RENT),
    ]
    if property_type:
        pt_clean = property_type.lower()
        if pt_clean in ("land", "house", "apartment", "commercial"):
            prop_filter.append(Property.property_type == PropertyType(pt_clean))

    prop_rows = db.execute(select(Property).where(*prop_filter)).scalars().all()
    matched_properties: list[dict[str, Any]] = []
    for p in prop_rows:
        loc = (p.location or "").lower()
        title_text = (p.title or "").lower()
        if any(token in loc or token in title_text for token in search_tokens):
            extracted_area = extract_sub_area(p.title or "", p.location or "", canonical_name)
            matched_properties.append({
                "id": str(p.id),
                "title": p.title,
                "source": "internal",
                "source_url": None,
                "property_type": p.property_type.value if hasattr(p.property_type, "value") else str(p.property_type),
                "price": p.price,
                "is_price_per_perch": p.is_price_per_perch,
                "land_size_perches": p.land_size_perches,
                "floor_area_sqft": p.floor_area_sqft,
                "sub_area": extracted_area,
                "date": p.created_at.strftime("%Y-%m-%d") if p.created_at else None,
            })

    # 2. Query Scraped Prospects (Filtered by timeframe)
    prospect_base_filter = [
        Prospect.status.notin_(["discarded"]),
        Prospect.listing_type.in_([listing_type, f"for_{listing_type}"]),
    ]
    if property_type:
        prospect_base_filter.append(Prospect.property_type == property_type.lower())

    # Try 90-day window first
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=max_days)
    timeframe_label = f"last_{max_days}_days"

    prospect_stmt_90 = select(Prospect).where(
        *prospect_base_filter,
        Prospect.first_seen_at >= cutoff_time,
    )
    prospect_rows = db.execute(prospect_stmt_90).scalars().all()

    # Fallback to all-time if fewer than 3 listings found in the 90-day window
    if len(prospect_rows) < 3:
        prospect_stmt_all = select(Prospect).where(*prospect_base_filter)
        all_rows = db.execute(prospect_stmt_all).scalars().all()
        if len(all_rows) > len(prospect_rows):
            prospect_rows = all_rows
            timeframe_label = "all_time (expanded due to sample size)"

    matched_prospects: list[dict[str, Any]] = []
    for pr in prospect_rows:
        sub_name = (pr.suburb or "").lower()
        loc_name = (pr.location or "").lower()
        title_name = (pr.title or "").lower()
        if (
            any(token == sub_name for token in search_tokens)
            or any(token in loc_name for token in search_tokens)
            or any(token in title_name for token in search_tokens)
        ):
            p_val = pr.price_numeric
            is_ppp = pr.is_price_per_perch
            if not p_val and pr.price:
                p_val, is_ppp = parse_lkr_price(pr.price)

            extracted_area = extract_sub_area(pr.title or "", pr.location or "", canonical_name)
            matched_prospects.append({
                "id": str(pr.id),
                "title": pr.title,
                "source": pr.source or "ikman",
                "source_url": pr.source_url or pr.ikman_url,
                "property_type": pr.property_type,
                "price": p_val,
                "is_price_per_perch": is_ppp,
                "land_size_perches": pr.land_size_perches,
                "floor_area_sqft": pr.floor_area_sqft,
                "sub_area": extracted_area,
                "date": pr.first_seen_at.strftime("%Y-%m-%d") if pr.first_seen_at else None,
            })

    all_listings = matched_properties + matched_prospects

    # Filter by sub-area if specifically requested
    filtered_listings = all_listings
    if target_sub_area and target_sub_area.lower() != "all":
        clean_target = target_sub_area.strip().lower()
        filtered_listings = [
            l for l in all_listings
            if clean_target in l["sub_area"].lower() or l["sub_area"].lower() in clean_target
        ]

    # Process prices and per-unit metrics
    primary_property_type = (property_type or "land").lower()
    is_apartment_or_commercial = primary_property_type in ("apartment", "commercial")
    primary_unit = "per_sqft" if is_apartment_or_commercial else "per_perch"
    unit_label = "LKR / Sq.Ft." if is_apartment_or_commercial else "LKR / Perch"

    raw_prices: list[Decimal] = []
    unit_rates: list[Decimal] = []
    sourced_items: list[dict[str, Any]] = []

    # Map of sub-area -> list of unit rates (for comparative chart)
    sub_area_rates_map: dict[str, list[Decimal]] = {}

    for item in filtered_listings:
        p_val = item["price"]
        if not p_val or p_val <= 0:
            continue

        item_unit_rate: Decimal | None = None
        item_total_price: Decimal | None = None

        pt = item["property_type"].lower()
        if pt == "land":
            if item["is_price_per_perch"]:
                item_unit_rate = p_val
                if item["land_size_perches"] and item["land_size_perches"] > 0:
                    item_total_price = p_val * item["land_size_perches"]
                else:
                    item_total_price = p_val
            else:
                item_total_price = p_val
                if item["land_size_perches"] and item["land_size_perches"] > 0:
                    item_unit_rate = p_val / item["land_size_perches"]
        elif pt in ("apartment", "commercial"):
            item_total_price = p_val
            if item["floor_area_sqft"] and item["floor_area_sqft"] > 0:
                item_unit_rate = p_val / Decimal(item["floor_area_sqft"])
        else:  # house
            item_total_price = p_val
            if item["land_size_perches"] and item["land_size_perches"] > 0:
                item_unit_rate = p_val / item["land_size_perches"]
            elif item["floor_area_sqft"] and item["floor_area_sqft"] > 0:
                item_unit_rate = p_val / Decimal(item["floor_area_sqft"])

        if item_total_price:
            raw_prices.append(item_total_price)
        if item_unit_rate:
            unit_rates.append(item_unit_rate)

        area_name = item["sub_area"]
        if item_unit_rate:
            sub_area_rates_map.setdefault(area_name, []).append(item_unit_rate)

        sourced_items.append({
            "id": item["id"],
            "title": item["title"],
            "source": item["source"],
            "source_url": item["source_url"],
            "property_type": item["property_type"],
            "total_price_lkr": float(item_total_price) if item_total_price else None,
            "unit_rate_lkr": float(item_unit_rate) if item_unit_rate else None,
            "unit_label": unit_label if item_unit_rate else None,
            "sub_area": area_name,
            "date": item["date"],
        })

    # Sub-Area Comparative list (grouped across all matched listings for this suburb)
    all_sub_area_rates_map: dict[str, list[Decimal]] = {}
    for item in all_listings:
        p_val = item["price"]
        if not p_val or p_val <= 0:
            continue
        pt = item["property_type"].lower()
        rate = None
        if pt == "land":
            if item["is_price_per_perch"]:
                rate = p_val
            elif item["land_size_perches"] and item["land_size_perches"] > 0:
                rate = p_val / item["land_size_perches"]
        elif pt in ("apartment", "commercial") and item["floor_area_sqft"] and item["floor_area_sqft"] > 0:
            rate = p_val / Decimal(item["floor_area_sqft"])
        elif item["land_size_perches"] and item["land_size_perches"] > 0:
            rate = p_val / item["land_size_perches"]

        if rate:
            all_sub_area_rates_map.setdefault(item["sub_area"], []).append(rate)

    sub_areas_comparison: list[dict[str, Any]] = []
    for area_name, rates in all_sub_area_rates_map.items():
        area_pct = _percentiles(rates)
        sub_areas_comparison.append({
            "name": area_name,
            "sample_count": len(rates),
            "median_unit_rate": area_pct["median"],
            "min_unit_rate": area_pct["min"],
            "max_unit_rate": area_pct["max"],
            "p25_unit_rate": area_pct["p25"],
            "p75_unit_rate": area_pct["p75"],
        })
    # Sort sub-areas by median rate descending
    sub_areas_comparison.sort(
        key=lambda x: x["median_unit_rate"] if x["median_unit_rate"] is not None else 0,
        reverse=True,
    )

    # Compute percentiles
    unit_stats = _percentiles(unit_rates)
    total_stats = _percentiles(raw_prices)

    # MarketBenchmark fallback if active listing samples are sparse or empty
    if not unit_stats["median"] or len(filtered_listings) < 3:
        from app.models.market_benchmark import MarketBenchmark
        from app.services.benchmark_sync import normalize_location_name
        from sqlalchemy import func as sa_func
        norm_canonical = normalize_location_name(canonical_name)
        pt_target = property_type.lower() if property_type else ("land" if primary_property_type == "land" else "house")
        bm_stmt = select(MarketBenchmark).where(
            sa_func.lower(MarketBenchmark.location) == norm_canonical.lower(),
            MarketBenchmark.property_type == pt_target,
            MarketBenchmark.listing_type == listing_type.lower(),
            MarketBenchmark.status == "active",
        ).limit(1)
        bm_row = db.execute(bm_stmt).scalar_one_or_none()
        if bm_row:
            bm_rate = None
            if primary_unit == "per_perch" and bm_row.rate_per_perch:
                bm_rate = float(bm_row.rate_per_perch)
            elif primary_unit == "per_sqft" and bm_row.rate_per_sqft:
                bm_rate = float(bm_row.rate_per_sqft)
            elif pt_target == "land" and bm_row.rate_per_perch:
                bm_rate = float(bm_row.rate_per_perch)
            elif bm_row.rate_per_sqft:
                bm_rate = float(bm_row.rate_per_sqft)

            if bm_rate and (not unit_stats["median"] or len(filtered_listings) < 3):
                unit_stats["median"] = bm_rate
                unit_stats["min"] = round(bm_rate * 0.85, 2)
                unit_stats["max"] = round(bm_rate * 1.15, 2)
                unit_stats["p25"] = round(bm_rate * 0.92, 2)
                unit_stats["p75"] = round(bm_rate * 1.08, 2)

    # CBSL Divisional / Baseline fallbacks
    baseline_land_min = float(suburb_entity.baseline_land_perch_min) if suburb_entity and suburb_entity.baseline_land_perch_min else None
    baseline_land_max = float(suburb_entity.baseline_land_perch_max) if suburb_entity and suburb_entity.baseline_land_perch_max else None
    baseline_sqft_min = float(suburb_entity.baseline_apartment_sqft_min) if suburb_entity and suburb_entity.baseline_apartment_sqft_min else None
    baseline_sqft_max = float(suburb_entity.baseline_apartment_sqft_max) if suburb_entity and suburb_entity.baseline_apartment_sqft_max else None

    # Realized deal target (-10% negotiation margin)
    realized_unit_target = (
        round(unit_stats["median"] * float(REALIZATION_DISCOUNT_FACTOR), 2)
        if unit_stats["median"]
        else None
    )
    realized_total_target = (
        round(total_stats["median"] * float(REALIZATION_DISCOUNT_FACTOR), 2)
        if total_stats["median"]
        else None
    )

    # Grading thresholds for prospect evaluation
    grading_thresholds = _calculate_grading_thresholds(unit_stats["median"] or total_stats["median"])

    # Sample Sourcing Breakdown
    source_counts: dict[str, int] = {}
    ptype_counts: dict[str, int] = {}
    for item in filtered_listings:
        src = item["source"]
        ptype = item["property_type"]
        source_counts[src] = source_counts.get(src, 0) + 1
        ptype_counts[ptype] = ptype_counts.get(ptype, 0) + 1

    sample_count = len(filtered_listings)
    if sample_count >= 15:
        confidence = "high"
    elif sample_count >= 5:
        confidence = "medium"
    elif sample_count >= 1:
        confidence = "low"
    elif suburb_entity is not None:
        confidence = "benchmark_supported"
    else:
        confidence = "indicative"

    # Natural Language Advisory Summary for Amaya
    advisory_parts = []
    location_desc = f"{canonical_name} ({target_sub_area})" if target_sub_area else canonical_name
    if unit_stats["median"]:
        advisory_parts.append(
            f"In {location_desc}, {primary_property_type} asking rates median is {_format_lkr_short(unit_stats['median'])} {unit_label} "
            f"(realistic closing target ~{_format_lkr_short(realized_unit_target)} {unit_label} with standard 10% negotiation). "
            f"Active listings range from {_format_lkr_short(unit_stats['min'])} up to {_format_lkr_short(unit_stats['max'])} {unit_label}."
        )
    elif baseline_land_min and primary_unit == "per_perch":
        advisory_parts.append(
            f"In {location_desc}, land benchmark rates typically range between {_format_lkr_short(baseline_land_min)} "
            f"and {_format_lkr_short(baseline_land_max)} per perch based on Central Bank Divisional indicators."
        )

    if sub_areas_comparison and len(sub_areas_comparison) > 1 and not target_sub_area:
        top_area = sub_areas_comparison[0]
        bottom_area = sub_areas_comparison[-1]
        if top_area["median_unit_rate"] and bottom_area["median_unit_rate"]:
            advisory_parts.append(
                f"Micro-market variations across {canonical_name} show {top_area['name']} at the high end "
                f"({_format_lkr_short(top_area['median_unit_rate'])} {unit_label}) compared to {bottom_area['name']} "
                f"({_format_lkr_short(bottom_area['median_unit_rate'])} {unit_label})."
            )

    advisory_parts.append(f"Grounded in {sample_count} verified & scraped market listings ({timeframe_label}).")
    advisory_summary = " ".join(advisory_parts)

    trends_data = calculate_monthly_trends(
        db=db,
        location_query=canonical_name,
        sub_area_filter=target_sub_area,
        property_type=primary_property_type,
        listing_type=listing_type,
        months_back=6,
    )

    return {
        "suburb": canonical_name,
        "sub_area": target_sub_area,
        "district": district,
        "ds_division": ds_division,
        "property_type": property_type or "all",
        "listing_type": listing_type,
        "timeframe": timeframe_label,
        "sample_summary": {
            "total_sourced": sample_count,
            "sources": source_counts,
            "by_property_type": ptype_counts,
            "confidence": confidence,
        },
        "unit_pricing": {
            "primary_unit": primary_unit,
            "unit_label": unit_label,
            "min": unit_stats["min"],
            "p25_entry": unit_stats["p25"],
            "median_asking": unit_stats["median"],
            "p75_premium": unit_stats["p75"],
            "max": unit_stats["max"],
            "realized_deal_target": realized_unit_target,
            "benchmark_range": (
                [baseline_sqft_min, baseline_sqft_max]
                if is_apartment_or_commercial
                else [baseline_land_min, baseline_land_max]
            ),
        },
        "total_pricing": {
            "min": total_stats["min"],
            "p25_entry": total_stats["p25"],
            "median_asking": total_stats["median"],
            "p75_premium": total_stats["p75"],
            "max": total_stats["max"],
            "realized_deal_target": realized_total_target,
        },
        "grading_thresholds": {
            "metric": unit_label,
            "underpriced_max": grading_thresholds["underpriced_max"],
            "fair_value_min": grading_thresholds["fair_value_min"],
            "fair_value_max": grading_thresholds["fair_value_max"],
            "overpriced_min": grading_thresholds["overpriced_min"],
        },
        "sub_areas": sub_areas_comparison,
        "sourced_listings": sourced_items[:30],
        "advisory_summary": advisory_summary,
        "monthly_trends": trends_data["monthly_trends"],
        "overall_trend_direction": trends_data["overall_trend_direction"],
        "overall_trend_percent": trends_data["overall_trend_percent"],
        # Backward compatibility fields for legacy consumers
        "sample_size": sample_count,
        "stats": {
            "median_asking_price_lkr": total_stats["median"],
            "estimated_realized_price_lkr": realized_total_target,
            "price_per_perch_lkr": {
                "asking_median": unit_stats["median"] if primary_unit == "per_perch" else None,
                "realized_estimate": realized_unit_target if primary_unit == "per_perch" else None,
                "benchmark_range": [baseline_land_min, baseline_land_max] if baseline_land_min else None,
            },
            "price_per_sqft_lkr": {
                "asking_median": unit_stats["median"] if primary_unit == "per_sqft" else None,
                "benchmark_range": [baseline_sqft_min, baseline_sqft_max] if baseline_sqft_min else None,
            },
        },
    }


def calculate_monthly_trends(
    db: Session,
    location_query: str,
    sub_area_filter: str | None = None,
    property_type: str | None = "land",
    listing_type: str = "sale",
    months_back: int = 6,
) -> dict[str, Any]:
    """
    Computes monthly median unit rate trends and month-over-month percentage changes
    for the specified suburb and micro-area across the last `months_back` months.
    """
    suburb_entity, detected_sub_area = get_suburb_by_query(db, location_query)
    target_sub_area = sub_area_filter or detected_sub_area
    canonical_name = suburb_entity.name if suburb_entity else location_query.title()

    search_tokens = [canonical_name.lower()]
    if suburb_entity:
        search_tokens.append(suburb_entity.slug.lower())
        search_tokens.extend([a.lower() for a in suburb_entity.aliases])

    # Determine month slots (e.g., last 6 months)
    now = datetime.now(timezone.utc)
    slots: list[tuple[str, str, datetime, datetime]] = []
    for i in range(months_back - 1, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        period_str = f"{y:04d}-{m:02d}"
        month_label = datetime(y, m, 1).strftime("%b %Y")
        start_dt = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            end_dt = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_dt = datetime(y, m + 1, 1, tzinfo=timezone.utc)
        slots.append((period_str, month_label, start_dt, end_dt))

    earliest_dt = slots[0][2]
    pt = (property_type or "land").lower()
    is_apartment_or_commercial = pt in ("apartment", "commercial")
    unit_label = "LKR / Sq.Ft." if is_apartment_or_commercial else "LKR / Perch"

    # Query prospects in overall window
    prospect_stmt = select(Prospect).where(
        Prospect.status.notin_(["discarded"]),
        Prospect.listing_type.in_([listing_type, f"for_{listing_type}"]),
        Prospect.first_seen_at >= earliest_dt,
    )
    if property_type:
        prospect_stmt = prospect_stmt.where(Prospect.property_type == pt)

    prospect_rows = db.execute(prospect_stmt).scalars().all()

    # Query internal properties
    prop_stmt = select(Property).where(
        Property.status.in_([PropertyStatus.AVAILABLE, PropertyStatus.SOLD, PropertyStatus.UNDER_OFFER]),
        Property.listing_type == (ListingType.SALE if listing_type == "sale" else ListingType.RENT),
        Property.created_at >= earliest_dt,
    )
    if property_type and pt in ("land", "house", "apartment", "commercial"):
        prop_stmt = prop_stmt.where(Property.property_type == PropertyType(pt))

    prop_rows = db.execute(prop_stmt).scalars().all()

    rates_by_period: dict[str, list[Decimal]] = {slot[0]: [] for slot in slots}

    def process_item(title: str, loc: str, date_dt: datetime | None, p_type: str, price_val: Decimal | None, is_ppp: bool, perches: Decimal | None, sqft: int | None):
        if not date_dt:
            return
        p_str = date_dt.strftime("%Y-%m")
        if p_str not in rates_by_period:
            return
        combined = f"{title} {loc}".lower()
        if not any(t in combined for t in search_tokens):
            return
        if target_sub_area and target_sub_area.lower() != "all":
            area = extract_sub_area(title, loc, canonical_name)
            if target_sub_area.lower() not in area.lower() and area.lower() not in target_sub_area.lower():
                return
        if not price_val or price_val <= 0:
            return

        rate = None
        if p_type == "land":
            if is_ppp:
                rate = price_val
            elif perches and perches > 0:
                rate = price_val / perches
        elif p_type in ("apartment", "commercial") and sqft and sqft > 0:
            rate = price_val / Decimal(sqft)
        elif perches and perches > 0:
            rate = price_val / perches
        elif sqft and sqft > 0:
            rate = price_val / Decimal(sqft)

        if rate:
            rates_by_period[p_str].append(rate)

    for pr in prospect_rows:
        p_val = pr.price_numeric
        is_ppp = pr.is_price_per_perch
        if not p_val and pr.price:
            p_val, is_ppp = parse_lkr_price(pr.price)
        process_item(pr.title or "", pr.location or "", pr.first_seen_at, pr.property_type, p_val, is_ppp, pr.land_size_perches, pr.floor_area_sqft)

    for p in prop_rows:
        process_item(
            p.title or "",
            p.location or "",
            p.created_at,
            p.property_type.value if hasattr(p.property_type, "value") else str(p.property_type),
            p.price,
            p.is_price_per_perch,
            p.land_size_perches,
            p.floor_area_sqft,
        )

    trend_items: list[dict[str, Any]] = []
    prev_median: float | None = None

    for period_str, month_label, _, _ in slots:
        rates = rates_by_period.get(period_str, [])
        sample_count = len(rates)
        pct = _percentiles(rates)
        med = pct["median"]

        chg_pct = None
        if med is not None and prev_median is not None and prev_median > 0:
            chg_pct = round(((med - prev_median) / prev_median) * 100, 1)

        trend_items.append({
            "period": period_str,
            "month_label": month_label,
            "median_unit_rate": med,
            "sample_count": sample_count,
            "unit_label": unit_label,
            "change_percent": chg_pct,
        })

        if med is not None:
            prev_median = med

    active_points = [t for t in trend_items if t["median_unit_rate"] is not None]
    overall_dir = "stable"
    overall_pct = None

    if len(active_points) >= 2:
        first_med = active_points[0]["median_unit_rate"]
        last_med = active_points[-1]["median_unit_rate"]
        if first_med and last_med:
            overall_pct = round(((last_med - first_med) / first_med) * 100, 1)
            if overall_pct > 2.0:
                overall_dir = "up"
            elif overall_pct < -2.0:
                overall_dir = "down"

    return {
        "monthly_trends": trend_items,
        "overall_trend_direction": overall_dir,
        "overall_trend_percent": overall_pct,
        "unit_label": unit_label,
    }


def grade_prospect_pricing(
    db: Session,
    prospect: Prospect,
    valuation_cache: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Grades an individual prospect's pricing against market valuation benchmarks:
    - underpriced (>15% below market)
    - fair_market (within +/-15%)
    - overpriced (>15% above market)
    - unrated (insufficient specifications or missing price)
    """
    p_val = prospect.price_numeric
    is_ppp = prospect.is_price_per_perch
    if not p_val and prospect.price:
        p_val, is_ppp = parse_lkr_price(prospect.price)

    if not p_val or p_val <= 0:
        return {
            "price_grade": "unrated",
            "price_grade_label": None,
            "price_unit_rate": None,
            "price_unit_label": None,
            "market_median_unit_rate": None,
            "price_diff_percent": None,
        }

    pt = (prospect.property_type or "land").lower()
    unit_rate: float | None = None
    unit_label: str | None = None

    if pt == "land":
        unit_label = "LKR / Perch"
        if is_ppp:
            unit_rate = float(p_val)
        elif prospect.land_size_perches and prospect.land_size_perches > 0:
            unit_rate = float(p_val / prospect.land_size_perches)
    elif pt in ("apartment", "commercial"):
        unit_label = "LKR / Sq.Ft."
        if prospect.floor_area_sqft and prospect.floor_area_sqft > 0:
            unit_rate = float(p_val / Decimal(prospect.floor_area_sqft))
    else:  # house
        if prospect.land_size_perches and prospect.land_size_perches > 0:
            unit_label = "LKR / Perch"
            unit_rate = float(p_val / prospect.land_size_perches)
        elif prospect.floor_area_sqft and prospect.floor_area_sqft > 0:
            unit_label = "LKR / Sq.Ft."
            unit_rate = float(p_val / Decimal(prospect.floor_area_sqft))

    if not unit_rate:
        return {
            "price_grade": "unrated",
            "price_grade_label": None,
            "price_unit_rate": None,
            "price_unit_label": unit_label,
            "market_median_unit_rate": None,
            "price_diff_percent": None,
        }

    # Location lookup
    target_loc = prospect.suburb or prospect.location or "Colombo"
    cache_key = f"{target_loc.lower()}:{pt}"

    if valuation_cache is not None and cache_key in valuation_cache:
        valuation = valuation_cache[cache_key]
    else:
        valuation = calculate_suburb_market_value(
            db=db,
            location_query=target_loc,
            property_type=pt,
            listing_type="sale" if "sale" in (prospect.listing_type or "sale") else "rent",
        )
        if valuation_cache is not None:
            valuation_cache[cache_key] = valuation

    # Check for micro-area specific median
    extracted_area = extract_sub_area(prospect.title or "", prospect.location or "", valuation.get("suburb", ""))
    target_median: float | None = None

    for sa in valuation.get("sub_areas", []):
        if (
            sa["name"].lower() == extracted_area.lower()
            and sa["median_unit_rate"]
            and sa.get("sample_count", 0) >= 3
        ):
            target_median = sa["median_unit_rate"]
            break

    if not target_median:
        target_median = valuation.get("unit_pricing", {}).get("median_asking")

    # Fallback to benchmark range midpoint if asking median is unavailable
    if not target_median:
        b_range = valuation.get("unit_pricing", {}).get("benchmark_range")
        if b_range and b_range[0] and b_range[1]:
            target_median = (b_range[0] + b_range[1]) / 2

    # Direct MarketBenchmark fallback for prospects where suburb listing data is missing or unmapped
    if not target_median:
        from app.models.market_benchmark import MarketBenchmark
        from app.services.benchmark_sync import normalize_location_name
        from sqlalchemy import func as sa_func

        norm_loc = normalize_location_name(target_loc)
        l_type = "sale" if "sale" in (prospect.listing_type or "sale") else "rent"
        bm_row = db.execute(
            select(MarketBenchmark).where(
                sa_func.lower(MarketBenchmark.location) == norm_loc.lower(),
                MarketBenchmark.property_type == pt,
                MarketBenchmark.listing_type == l_type,
                MarketBenchmark.status == "active",
            ).limit(1)
        ).scalar_one_or_none()
        if bm_row:
            if pt == "land" and bm_row.rate_per_perch:
                target_median = float(bm_row.rate_per_perch)
            elif pt in ("apartment", "commercial") and bm_row.rate_per_sqft:
                target_median = float(bm_row.rate_per_sqft)
            elif pt == "house":
                if unit_label == "LKR / Sq.Ft." and bm_row.rate_per_sqft:
                    target_median = float(bm_row.rate_per_sqft)
                elif unit_label == "LKR / Perch" and bm_row.rate_per_perch:
                    target_median = float(bm_row.rate_per_perch)

    if not target_median or target_median <= 0:
        return {
            "price_grade": "unrated",
            "price_grade_label": None,
            "price_unit_rate": round(unit_rate, 2),
            "price_unit_label": unit_label,
            "market_median_unit_rate": None,
            "price_diff_percent": None,
        }

    diff_pct = round(((unit_rate - target_median) / target_median) * 100, 1)

    if diff_pct < -15.0:
        grade = "underpriced"
        label = f"Deal: {abs(int(diff_pct))}% below market"
    elif diff_pct > 15.0:
        grade = "overpriced"
        label = f"Overpriced: +{int(diff_pct)}%"
    else:
        grade = "fair_market"
        label = f"Fair Market (±{abs(int(diff_pct))}%)" if abs(int(diff_pct)) > 0 else "Fair Market"

    return {
        "price_grade": grade,
        "price_grade_label": label,
        "price_unit_rate": round(unit_rate, 2),
        "price_unit_label": unit_label,
        "market_median_unit_rate": round(target_median, 2),
        "price_diff_percent": diff_pct,
    }


def bulk_grade_prospects(
    db: Session,
    prospects: list[Prospect],
) -> dict[Any, dict[str, Any]]:
    """
    Grades multiple prospects with caching across suburbs.
    Returns mapping of prospect.id -> grade info.
    """
    cache: dict[str, Any] = {}
    result: dict[Any, dict[str, Any]] = {}
    for p in prospects:
        result[p.id] = grade_prospect_pricing(db, p, cache)
    return result
