from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from app.agent import tools
from app.agent.tools import ToolArgumentError, ToolContext
from app.models import Conversation, Property, PropertyStatus, PropertyType, Suburb, Prospect
from app.services.price_parser import parse_lkr_price
from app.services.market_valuation import calculate_suburb_market_value
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


class TestMarketValuationService:
    def test_seeded_suburb_benchmarks(self, db_session: Session):
        seed_suburbs_data(db_session)

        # Rajagiriya benchmark check
        res = calculate_suburb_market_value(db_session, "Rajagiriya", property_type="land")
        assert res["suburb"] == "Rajagiriya"
        assert res["district"] == "Colombo"
        assert res["tier"] == "Inner Suburbs (Affluent)"
        assert res["stats"]["price_per_perch_lkr"]["benchmark_range"] == [4500000.0, 7500000.0]

    def test_market_value_aggregation_with_live_listings(self, db_session: Session):
        seed_suburbs_data(db_session)

        # Add a Prospect in Rajagiriya
        p = Prospect(
            title="Prime Land in Rajagiriya",
            price="Rs 5,000,000 per perch",
            price_numeric=Decimal("5000000"),
            is_price_per_perch=True,
            land_size_perches=Decimal("10"),
            location="Rajagiriya",
            suburb="Rajagiriya",
            property_type="land",
            listing_type="sale",
            classification="owner",
            confidence=85,
            classification_reasons=["test"],
            classification_method="heuristic",
            status="new",
        )
        db_session.add(p)
        db_session.commit()

        res = calculate_suburb_market_value(db_session, "Rajagiriya", property_type="land")
        assert res["sample_size"] >= 1
        assert res["stats"]["price_per_perch_lkr"]["asking_median"] == 5000000.0
        # 10% realization discount applied
        assert res["stats"]["price_per_perch_lkr"]["realized_estimate"] == 4500000.0


class TestAgentMarketValueTool:
    def test_missing_location_raises_tool_argument_error(self, db_session: Session):
        ctx = _context(db_session)
        with pytest.raises(ToolArgumentError):
            tools.get_market_value(ctx, {})

    def test_market_value_tool_execution(self, db_session: Session):
        seed_suburbs_data(db_session)
        ctx = _context(db_session)
        res = tools.execute_tool(
            "get_market_value",
            {"location": "Colombo 7", "property_type": "apartment"},
            ctx,
        )
        assert "error" not in res
        assert res["suburb"] == "Colombo 7"
        assert res["stats"]["price_per_sqft_lkr"]["benchmark_range"] == [70000.0, 130000.0]
