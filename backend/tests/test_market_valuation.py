from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from app.agent import tools
from app.agent.tools import ToolArgumentError, ToolContext
from app.models import Conversation, Property, PropertyStatus, PropertyType, Suburb, Prospect
from app.services.price_parser import parse_lkr_price
from app.services.market_valuation import calculate_suburb_market_value, extract_sub_area
from app.services.suburb_seeds import seed_suburbs_data


def _context(session: Session, session_id: str = "tool-mv-sess") -> ToolContext:
    conversation = Conversation(session_id=session_id)
    session.add(conversation)
    session.flush()
    return ToolContext(db=session, conversation_id=conversation.id)


class TestPriceParser:
    def test_parse_simple_numeric(self):
        val, is_pp = parse_lkr_price(35000000)
        assert val == Decimal("35000000")
        assert not is_pp

    def test_parse_lakhs_and_millions(self):
        val, is_pp = parse_lkr_price("45 lakhs")
        assert val == Decimal("4500000")
        assert not is_pp

        val, is_pp = parse_lkr_price("3.5m")
        assert val == Decimal("3500000")
        assert not is_pp

    def test_parse_per_perch(self):
        val, is_pp = parse_lkr_price("Rs 4,500,000 per perch")
        assert val == Decimal("4500000")
        assert is_pp

        val, is_pp = parse_lkr_price("2.5m /perch")
        assert val == Decimal("2500000")
        assert is_pp


class TestSubAreaExtractor:
    def test_known_sub_area_extraction(self):
        area = extract_sub_area("House with Shop in Attidiya, Dehiwala", "Dehiwala", "Dehiwala")
        assert area == "Attidiya"

        area2 = extract_sub_area("Valuable Land in Waidya Road Dehiwala", "Dehiwala", "Dehiwala")
        assert area2 == "Waidya Road"

        area3 = extract_sub_area("Commercial Property near Kalubowila Hospital", "Dehiwala", "Dehiwala")
        assert area3 == "Kalubowila"

    def test_fallback_sub_area(self):
        area = extract_sub_area("Prime Land for Sale 30 Perches", "Dehiwala", "Dehiwala")
        assert area == "Central Dehiwala"


class TestMarketValuationService:
    def test_seeded_suburb_benchmarks(self, db_session: Session):
        seed_suburbs_data(db_session)

        # Rajagiriya benchmark check
        res = calculate_suburb_market_value(db_session, "Rajagiriya", property_type="land")
        assert res["suburb"] == "Rajagiriya"
        assert res["district"] == "Colombo"
        assert res["unit_pricing"]["primary_unit"] == "per_perch"
        assert res["unit_pricing"]["benchmark_range"] == [4500000.0, 7500000.0]

    def test_market_value_aggregation_with_live_listings_and_sub_areas(self, db_session: Session):
        seed_suburbs_data(db_session)

        # Add listings in Dehiwala with different sub-areas
        p1 = Prospect(
            title="House in Attidiya, Dehiwala",
            price="Rs 2,600,000 per perch",
            price_numeric=Decimal("2600000"),
            is_price_per_perch=True,
            land_size_perches=Decimal("10"),
            location="Dehiwala",
            suburb="Dehiwala",
            property_type="land",
            listing_type="sale",
            classification="owner",
            confidence=85,
            classification_reasons=["test"],
            classification_method="heuristic",
            status="new",
        )
        p2 = Prospect(
            title="Valuable Land in Waidya Road Dehiwala",
            price="Rs 6,500,000 per perch",
            price_numeric=Decimal("6500000"),
            is_price_per_perch=True,
            land_size_perches=Decimal("10"),
            location="Dehiwala",
            suburb="Dehiwala",
            property_type="land",
            listing_type="sale",
            classification="owner",
            confidence=90,
            classification_reasons=["test"],
            classification_method="heuristic",
            status="new",
        )
        db_session.add_all([p1, p2])
        db_session.commit()

        # Query entire Dehiwala
        res = calculate_suburb_market_value(db_session, "Dehiwala", property_type="land")
        assert res["sample_summary"]["total_sourced"] >= 2
        assert res["unit_pricing"]["min"] == 2600000.0
        assert res["unit_pricing"]["max"] == 6500000.0
        # Sub-area breakdown present
        sub_area_names = [sa["name"] for sa in res["sub_areas"]]
        assert "Attidiya" in sub_area_names
        assert "Waidya Road" in sub_area_names

        # Grading thresholds computed
        assert res["grading_thresholds"]["fair_value_min"] is not None
        assert res["grading_thresholds"]["fair_value_max"] is not None

        # Sourced listings breakdown
        assert len(res["sourced_listings"]) >= 2
        assert res["sample_summary"]["sources"]["ikman"] >= 2

        # Query specific sub-area: Attidiya
        res_attidiya = calculate_suburb_market_value(db_session, "Dehiwala", sub_area_filter="Attidiya", property_type="land")
        assert res_attidiya["sample_summary"]["total_sourced"] == 1
        assert res_attidiya["unit_pricing"]["median_asking"] == 2600000.0
        # Realized deal price has 10% negotiation discount
        assert res_attidiya["unit_pricing"]["realized_deal_target"] == 2340000.0


class TestAgentMarketValueTool:
    def test_missing_location_raises_tool_argument_error(self, db_session: Session):
        ctx = _context(db_session)
        with pytest.raises(ToolArgumentError):
            tools.get_market_value(ctx, {})

    def test_market_value_tool_execution_with_sub_area(self, db_session: Session):
        seed_suburbs_data(db_session)
        ctx = _context(db_session)
        res = tools.execute_tool(
            "get_market_value",
            {"location": "Dehiwala", "sub_area": "Attidiya", "property_type": "land"},
            ctx,
        )
        assert "error" not in res
        assert res["suburb"] == "Dehiwala"
        assert res["sub_area"] == "Attidiya"
        assert "advisory_summary" in res
        assert len(res["advisory_summary"]) > 20


class TestProspectPriceGrading:
    def test_prospect_grading_deal_vs_overpriced(self, db_session: Session):
        from app.services.market_valuation import grade_prospect_pricing
        seed_suburbs_data(db_session)

        # Baseline in Rajagiriya is 4.5M - 7.5M per perch (median ~6M)
        # 1. Underpriced deal: 3.5M per perch (>15% below median 6M)
        p_deal = Prospect(
            title="Urgent Land Sale in Rajagiriya",
            price="Rs 3,500,000 per perch",
            price_numeric=Decimal("3500000"),
            is_price_per_perch=True,
            location="Rajagiriya",
            suburb="Rajagiriya",
            property_type="land",
            listing_type="sale",
            classification="owner",
            confidence=90,
            status="new",
        )
        grade_deal = grade_prospect_pricing(db_session, p_deal)
        assert grade_deal["price_grade"] == "underpriced"
        assert "Deal" in grade_deal["price_grade_label"]
        assert grade_deal["price_diff_percent"] < -15

        # 2. Overpriced listing: 9.5M per perch (>15% above median 6M)
        p_over = Prospect(
            title="Premium Commercial Land in Rajagiriya",
            price="Rs 9,500,000 per perch",
            price_numeric=Decimal("9500000"),
            is_price_per_perch=True,
            location="Rajagiriya",
            suburb="Rajagiriya",
            property_type="land",
            listing_type="sale",
            classification="owner",
            confidence=90,
            status="new",
        )
        grade_over = grade_prospect_pricing(db_session, p_over)
        assert grade_over["price_grade"] == "overpriced"
        assert "Overpriced" in grade_over["price_grade_label"]
        assert grade_over["price_diff_percent"] > 15


class TestMonthlyTrends:
    def test_monthly_trends_calculation(self, db_session: Session):
        from app.services.market_valuation import calculate_monthly_trends
        seed_suburbs_data(db_session)

        # Query trends for Dehiwala
        trends = calculate_monthly_trends(db_session, "Dehiwala", property_type="land", months_back=6)
        assert "monthly_trends" in trends
        assert len(trends["monthly_trends"]) == 6
        assert "overall_trend_direction" in trends
        assert trends["unit_label"] == "LKR / Perch"
        # Check period format YYYY-MM
        for item in trends["monthly_trends"]:
            assert len(item["period"]) == 7
            assert "median_unit_rate" in item
