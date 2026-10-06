"""Market benchmark synchronization service.

Fetches localized real estate asking price baselines from LankaPropertyWeb OPPI
and stores them in `market_benchmarks` for sub-millisecond local valuation lookups.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import json
import urllib.parse
from typing import Any

import httpx
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
import structlog

from app.models.market_benchmark import MarketBenchmark
from app.models.property import Property
from app.models.prospect import Prospect
from app.models.site_configuration import SiteConfiguration
from app.scraper.lpw_client import LPW_BASE_URL

logger = structlog.get_logger(__name__)

LPW_VALIDATE_URL = f"{LPW_BASE_URL}/api/v3/PriceValidateV2"
LPW_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiYXBpX2tleSJ9.l6YJhp_Jm2tryHhDdodj0E1kui6vfLordQUDXWF3y3U"

DEFAULT_COLOMBO_LOCATIONS = [
    "Colombo 1", "Colombo 2", "Colombo 3", "Colombo 4", "Colombo 5",
    "Colombo 6", "Colombo 7", "Colombo 8", "Colombo 9", "Colombo 10",
    "Colombo 11", "Colombo 12", "Colombo 13", "Colombo 14", "Colombo 15",
    "Dehiwala", "Mount Lavinia", "Rajagiriya", "Battaramulla", "Nawala",
    "Nugegoda", "Kotte", "Malabe", "Thalawathugoda", "Kaduwela",
    "Pannipitiya", "Maharagama", "Kohuwala", "Pelawatte", "Kandy", "Galle"
]


def normalize_location_name(loc: str | None) -> str:
    """Normalizes location strings (e.g. 'Colombo 03' -> 'Colombo 3')."""
    if not loc:
        return ""
    cleaned = loc.strip()
    # Normalize Colombo zero prefixes
    for i in range(1, 10):
        cleaned = cleaned.replace(f"Colombo 0{i}", f"Colombo {i}")
        cleaned = cleaned.replace(f"Colombo+0{i}", f"Colombo {i}")
        cleaned = cleaned.replace(f"Colombo+{i}", f"Colombo {i}")
    return cleaned


def get_target_sync_locations(session: Session, custom_locations: list[str] | None = None) -> list[str]:
    """Collects unique locations from DB properties, prospects, and default list."""
    loc_set = set(DEFAULT_COLOMBO_LOCATIONS)

    if custom_locations:
        for loc in custom_locations:
            if loc and loc.strip():
                loc_set.add(normalize_location_name(loc))

    # Pull distinct locations from published properties
    prop_locs = session.execute(select(Property.location).where(Property.location.isnot(None)).distinct()).scalars().all()
    for loc in prop_locs:
        if loc and loc.strip():
            loc_set.add(normalize_location_name(loc))

    # Pull top distinct locations from prospects
    prosp_locs = session.execute(select(Prospect.location).where(Prospect.location.isnot(None)).distinct()).scalars().all()
    for loc in prosp_locs:
        if loc and loc.strip():
            loc_set.add(normalize_location_name(loc))

    return sorted(list(loc_set))


async def fetch_benchmark_from_lpw(
    client: httpx.AsyncClient,
    location: str,
    property_type: str,
    listing_type: str,
) -> tuple[Decimal | None, Decimal | None, str]:
    """Queries LPW's PriceValidateV2 and calculates the baseline rate per sqft or per perch.

    Returns: (rate_per_sqft, rate_per_perch, status)
    """
    offer_type = "rentals" if listing_type == "rent" else ("land" if property_type == "land" else "sales")
    lpw_prop_type = "Bare Land" if property_type == "land" else ("Apartment" if property_type == "apartment" else "House")

    # Use a standard testing probe
    if property_type == "land":
        test_price = 2_500_000
        params = {
            "token": LPW_TOKEN,
            "offer_type": "land",
            "property_type": "Bare Land",
            "city": location,
            "price": str(test_price),
            "floor_area": "",
            "land_area": "1",
            "price_type": "Per Perch",
            "pagetype": "market-insight",
        }
    elif listing_type == "rent":
        test_price = 250_000
        params = {
            "token": LPW_TOKEN,
            "offer_type": "rentals",
            "property_type": lpw_prop_type,
            "city": location,
            "price": str(test_price),
            "floor_area": "1000",
            "land_area": "",
            "price_type": "Per Month",
            "pagetype": "market-insight",
        }
    else:
        test_price = 100_000_000
        params = {
            "token": LPW_TOKEN,
            "offer_type": "sales",
            "property_type": lpw_prop_type,
            "city": location,
            "price": str(test_price),
            "floor_area": "1000",
            "land_area": "",
            "price_type": "Total",
            "pagetype": "market-insight",
        }

    try:
        resp = await client.get(LPW_VALIDATE_URL, params=params, timeout=12.0)
        if resp.status_code != 200:
            return None, None, f"http_error_{resp.status_code}"

        data = resp.json()
        msg_obj = data.get("message")
        if not isinstance(msg_obj, dict):
            return None, None, "insufficient_data"

        pct_avg = msg_obj.get("percentage_avg")
        if pct_avg is None:
            return None, None, "insufficient_data"

        pct_float = float(pct_avg)
        # formula: price = benchmark * (1 + pct_avg / 100) => benchmark = price / (1 + pct_avg / 100)
        implied_total = Decimal(str(test_price)) / (Decimal("1") + Decimal(str(pct_float)) / Decimal("100"))

        if property_type == "land":
            rate_per_perch = implied_total.quantize(Decimal("1.00"))
            return None, rate_per_perch, "active"
        else:
            rate_per_sqft = (implied_total / Decimal("1000")).quantize(Decimal("1.00"))
            return rate_per_sqft, None, "active"

    except Exception as exc:
        logger.warning(
            "benchmark_sync.fetch_error",
            location=location,
            property_type=property_type,
            listing_type=listing_type,
            error=str(exc),
        )
        return None, None, f"error: {exc}"


async def run_benchmark_sync(
    session: Session,
    target_locations: list[str] | None = None,
    delay_between_calls: float = 0.4,
) -> dict[str, Any]:
    """Runs a full or scoped benchmark synchronization."""
    locations = target_locations or get_target_sync_locations(session)
    logger.info("benchmark_sync.started", location_count=len(locations))

    combinations = [
        ("house", "sale"),
        ("apartment", "sale"),
        ("land", "sale"),
        ("house", "rent"),
        ("apartment", "rent"),
    ]

    synced_count = 0
    skipped_count = 0
    now = datetime.now(timezone.utc)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(headers=headers, timeout=15.0, follow_redirects=True) as client:
        for loc in locations:
            for prop_type, list_type in combinations:
                rate_sqft, rate_perch, status = await fetch_benchmark_from_lpw(
                    client, loc, prop_type, list_type
                )
                await asyncio.sleep(delay_between_calls)

                # Upsert into market_benchmarks
                stmt = select(MarketBenchmark).where(
                    MarketBenchmark.location == loc,
                    MarketBenchmark.property_type == prop_type,
                    MarketBenchmark.listing_type == list_type,
                )
                existing = session.execute(stmt).scalar_one_or_none()

                if existing:
                    existing.rate_per_sqft = rate_sqft
                    existing.rate_per_perch = rate_perch
                    existing.status = status
                    existing.updated_at = now
                else:
                    new_item = MarketBenchmark(
                        location=loc,
                        property_type=prop_type,
                        listing_type=list_type,
                        rate_per_sqft=rate_sqft,
                        rate_per_perch=rate_perch,
                        status=status,
                        updated_at=now,
                    )
                    session.add(new_item)

                if status == "active":
                    synced_count += 1
                else:
                    skipped_count += 1

            session.commit()

    # Update SiteConfiguration
    cfg = session.execute(select(SiteConfiguration).limit(1)).scalar_one_or_none()
    if cfg:
        b_settings = dict(cfg.benchmark_sync_settings or {})
        freq_days = b_settings.get("frequency_days", 7)
        b_settings["last_run_at"] = now.isoformat()
        b_settings["last_run_status"] = f"Success: {synced_count} active rates synced, {skipped_count} no data."
        b_settings["next_run_at"] = (now + timedelta(days=freq_days)).isoformat()
        cfg.benchmark_sync_settings = b_settings
        flag_modified(cfg, "benchmark_sync_settings")
        session.commit()

    logger.info(
        "benchmark_sync.completed",
        synced_count=synced_count,
        skipped_count=skipped_count,
    )
    return {
        "success": True,
        "locations_scanned": len(locations),
        "synced_benchmarks": synced_count,
        "insufficient_data": skipped_count,
        "timestamp": now.isoformat(),
    }


def calculate_market_comparison(
    session: Session,
    location: str,
    property_type: str,
    listing_type: str,
    price: float | Decimal,
    floor_area_sqft: float | None = None,
    land_size_perches: float | None = None,
) -> dict[str, Any]:
    """Calculates where a given price stands relative to the stored benchmark."""
    norm_loc = normalize_location_name(location)
    p_type = property_type.lower()
    l_type = listing_type.lower()

    stmt = select(MarketBenchmark).where(
        func.lower(MarketBenchmark.location) == norm_loc.lower(),
        MarketBenchmark.property_type == p_type,
        MarketBenchmark.listing_type == l_type,
        MarketBenchmark.status == "active",
    )
    benchmark = session.execute(stmt).scalar_one_or_none()

    if not benchmark:
        # Try broader matching (e.g. without suffix if applicable)
        stmt_fuzzy = select(MarketBenchmark).where(
            MarketBenchmark.property_type == p_type,
            MarketBenchmark.listing_type == l_type,
            MarketBenchmark.status == "active",
            MarketBenchmark.location.ilike(f"%{norm_loc}%"),
        ).limit(1)
        benchmark = session.execute(stmt_fuzzy).scalar_one_or_none()

    if not benchmark:
        return {
            "has_benchmark": False,
            "message": f"No localized market benchmark available for {property_type} in {location}.",
        }

    price_dec = Decimal(str(price))
    expected_price: Decimal | None = None
    rate_desc: str = ""

    if p_type == "land" and benchmark.rate_per_perch and land_size_perches:
        expected_price = benchmark.rate_per_perch * Decimal(str(land_size_perches))
        rate_desc = f"Rs. {benchmark.rate_per_perch:,.0f} per perch"
    elif benchmark.rate_per_sqft and floor_area_sqft:
        expected_price = benchmark.rate_per_sqft * Decimal(str(floor_area_sqft))
        rate_desc = f"Rs. {benchmark.rate_per_sqft:,.0f} per sqft"

    if expected_price is None or expected_price <= 0:
        return {
            "has_benchmark": True,
            "rate_per_sqft": float(benchmark.rate_per_sqft) if benchmark.rate_per_sqft else None,
            "rate_per_perch": float(benchmark.rate_per_perch) if benchmark.rate_per_perch else None,
            "benchmark_location": benchmark.location,
            "has_size_for_comparison": False,
            "message": f"Benchmark for {property_type} in {benchmark.location} is {rate_desc}, but property size was not provided.",
        }

    delta_pct = ((price_dec - expected_price) / expected_price * Decimal("100")).quantize(Decimal("0.1"))
    abs_pct = abs(delta_pct)

    if delta_pct < -10:
        position = "below_market"
        label = f"{abs_pct}% below market average"
    elif delta_pct > 10:
        position = "above_market"
        label = f"{abs_pct}% above market average"
    else:
        position = "fair_market"
        label = f"fair market value ({abs_pct}% from average)"

    return {
        "has_benchmark": True,
        "benchmark_location": benchmark.location,
        "rate_per_sqft": float(benchmark.rate_per_sqft) if benchmark.rate_per_sqft else None,
        "rate_per_perch": float(benchmark.rate_per_perch) if benchmark.rate_per_perch else None,
        "expected_price": float(expected_price),
        "actual_price": float(price_dec),
        "percentage_delta": float(delta_pct),
        "position": position,
        "summary": (
            f"The asking price is {label} for a {floor_area_sqft or land_size_perches} "
            f"{'sqft' if floor_area_sqft else 'perch'} {property_type} in {benchmark.location} "
            f"(benchmark: {rate_desc})."
        ),
    }
