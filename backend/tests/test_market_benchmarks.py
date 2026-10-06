"""Unit tests for market benchmarks, valuation comparison, and sync settings."""

from decimal import Decimal
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.market_benchmark import MarketBenchmark
from app.models.site_configuration import SiteConfiguration
from app.services.benchmark_sync import (
    calculate_market_comparison,
    normalize_location_name,
)
from app.agent.tools import get_market_value, ToolContext
import uuid


@pytest.fixture
def sample_benchmarks(db_session: Session):
    b1 = MarketBenchmark(
        location="Colombo 3",
        property_type="apartment",
        listing_type="sale",
        rate_per_sqft=Decimal("66596.00"),
        rate_per_perch=None,
        status="active",
    )
    b2 = MarketBenchmark(
        location="Colombo 3",
        property_type="house",
        listing_type="sale",
        rate_per_sqft=Decimal("86949.00"),
        rate_per_perch=None,
        status="active",
    )
    b3 = MarketBenchmark(
        location="Battaramulla",
        property_type="land",
        listing_type="sale",
        rate_per_sqft=None,
        rate_per_perch=Decimal("2800000.00"),
        status="active",
    )
    db_session.add_all([b1, b2, b3])
    db_session.commit()
    return [b1, b2, b3]


def test_normalize_location_name():
    assert normalize_location_name("Colombo 03") == "Colombo 3"
    assert normalize_location_name("Colombo+07") == "Colombo 7"
    assert normalize_location_name("Battaramulla") == "Battaramulla"


def test_calculate_market_comparison_fair_market(db_session: Session, sample_benchmarks):
    # Colombo 3 apartment: 1000 sqft at ~66.5M should be fair market
    result = calculate_market_comparison(
        session=db_session,
        location="Colombo 3",
        property_type="apartment",
        listing_type="sale",
        price=67_000_000,
        floor_area_sqft=1000,
    )
    assert result["has_benchmark"] is True
    assert result["position"] == "fair_market"
    assert abs(result["percentage_delta"]) < 5.0
    assert "Colombo 3" in result["summary"]


def test_calculate_market_comparison_below_market(db_session: Session, sample_benchmarks):
    # Colombo 3 house: 2000 sqft benchmark is 2000 * 86949 = 173.8M. Asking 120M is below market!
    result = calculate_market_comparison(
        session=db_session,
        location="Colombo 3",
        property_type="house",
        listing_type="sale",
        price=120_000_000,
        floor_area_sqft=2000,
    )
    assert result["has_benchmark"] is True
    assert result["position"] == "below_market"
    assert result["percentage_delta"] < -10.0


def test_calculate_market_comparison_land(db_session: Session, sample_benchmarks):
    # Battaramulla land: 10 perches at 2.8M = 28M. Asking 35M is above market.
    result = calculate_market_comparison(
        session=db_session,
        location="Battaramulla",
        property_type="land",
        listing_type="sale",
        price=35_000_000,
        land_size_perches=10,
    )
    assert result["has_benchmark"] is True
    assert result["position"] == "above_market"
    assert result["percentage_delta"] > 10.0


def test_calculate_market_comparison_missing(db_session: Session):
    result = calculate_market_comparison(
        session=db_session,
        location="Jaffna",
        property_type="apartment",
        listing_type="sale",
        price=50_000_000,
        floor_area_sqft=1000,
    )
    assert result["has_benchmark"] is False


def test_agent_get_market_value_with_price_evaluation(db_session: Session, sample_benchmarks):
    ctx = ToolContext(db=db_session, conversation_id=uuid.uuid4())
    res = get_market_value(ctx, {
        "location": "Colombo 3",
        "property_type": "apartment",
        "price": "67 million",
        "floor_area_sqft": 1000,
    })
    assert "price_evaluation" in res
    assert res["price_evaluation"]["has_benchmark"] is True
    assert res["price_evaluation"]["position"] == "fair_market"


def test_site_configuration_has_benchmark_sync_settings(db_session: Session):
    cfg = SiteConfiguration(
        benchmark_sync_settings={
            "enabled": True,
            "frequency_days": 14,
            "custom_locations": ["Colombo 7"],
        }
    )
    db_session.add(cfg)
    db_session.commit()
    db_session.refresh(cfg)
    assert cfg.benchmark_sync_settings["frequency_days"] == 14


def test_prospect_grading_with_market_benchmark(db_session: Session, sample_benchmarks):
    from app.models.prospect import Prospect
    from app.services.market_valuation import grade_prospect_pricing

    # Colombo 3 apartment benchmark rate is ~66,596/sqft.
    # An apartment of 1,000 sqft priced at 45,000,000 (45,000/sqft) is >32% below market benchmark -> underpriced
    p = Prospect(
        title="Spacious 2BR Sea View Apartment in Colombo 3",
        price="Rs. 45,000,000",
        price_numeric=Decimal("45000000.00"),
        location="Colombo 3",
        property_type="apartment",
        listing_type="sale",
        floor_area_sqft=1000,
        classification="owner",
        confidence=90,
        classification_reasons=["direct owner"],
        classification_method="heuristic",
    )
    db_session.add(p)
    db_session.commit()

    grade = grade_prospect_pricing(db_session, p)
    assert grade["price_grade"] == "underpriced"
    assert "below market" in grade["price_grade_label"]
    assert grade["price_diff_percent"] < -15.0

