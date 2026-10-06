"""End-to-end multi-turn conversation and advisory verification for Amaya.

Verifies that Amaya uses `get_market_value` to answer going rate inquiries,
neighborhood/sub-area comparisons (e.g. Attidiya vs Kalubowila), deal evaluations,
and smoothly transitions into lead capture.
"""

from decimal import Decimal
import re
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.loop import run_turn as _run_turn
from app.agent.prompt_builder import build_system_prompt
from app.models import Conversation, Lead, Message, MessageRole, Prospect
from app.models.suburb import Suburb
from app.services.suburb_seeds import seed_suburbs_data
from tests.agent_fakes import (
    ScriptedGemini,
    call_response,
    text_response,
)


def run_turn(*args, **kwargs):
    raw = "".join(_run_turn(*args, **kwargs))
    return re.sub(r"\x00[^\x00]*\x00", "", raw).lstrip()


def _messages(session: Session) -> list[Message]:
    return list(session.execute(select(Message).order_by(Message.seq)).scalars())


@pytest.fixture
def seeded_market(db_session: Session):
    """Seeds suburbs catalog and sample prospects for Dehiwala and Rajagiriya."""
    seed_suburbs_data(db_session)

    # Add realistic sample prospects in Dehiwala with micro-areas
    p1 = Prospect(
        title="Land for Sale in Attidiya Dehiwala",
        price="Rs 2,600,000 per perch",
        price_numeric=Decimal("2600000"),
        is_price_per_perch=True,
        land_size_perches=Decimal("10.0"),
        location="Attidiya, Dehiwala",
        suburb="Dehiwala",
        property_type="land",
        listing_type="sale",
        classification="owner",
        confidence=90,
        classification_method="heuristic",
        classification_reasons=[],
        status="new",
    )
    p2 = Prospect(
        title="Prime Land on Waidya Road Dehiwala",
        price="Rs 6,500,000 per perch",
        price_numeric=Decimal("6500000"),
        is_price_per_perch=True,
        land_size_perches=Decimal("8.0"),
        location="Waidya Road, Dehiwala",
        suburb="Dehiwala",
        property_type="land",
        listing_type="sale",
        classification="owner",
        confidence=95,
        classification_method="heuristic",
        classification_reasons=[],
        status="new",
    )
    p3 = Prospect(
        title="Residential Land in Kalubowila",
        price="Rs 5,500,000 per perch",
        price_numeric=Decimal("5500000"),
        is_price_per_perch=True,
        land_size_perches=Decimal("6.5"),
        location="Kalubowila, Dehiwala",
        suburb="Dehiwala",
        property_type="land",
        listing_type="sale",
        classification="owner",
        confidence=90,
        classification_method="heuristic",
        classification_reasons=[],
        status="new",
    )
    db_session.add_all([p1, p2, p3])
    db_session.commit()
    return db_session


class TestPersonaPromptMarketIntelligence:
    def test_market_intelligence_rules_present_in_system_prompt(self, db_session: Session):
        prompt = build_system_prompt(db_session)
        assert "Market Valuations & Price Intelligence" in prompt
        assert "get_market_value" in prompt
        assert "quote per-perch rates for land and houses, and per-sqft for apartments" in prompt
        assert "actual closing deals typically settle 5% to 10% lower" in prompt
        assert "Evaluate deal inquiries objectively" in prompt
        assert "Bridge smoothly into lead capture" in prompt


class TestAmayaMarketValueAdvisoryMultiTurn:
    def test_market_going_rate_inquiry_calls_tool_and_answers_with_per_perch(
        self, seeded_market: Session
    ):
        """User asks for going rates in Dehiwala.

        Verifies tool execution, payload contents, and natural prose response.
        """
        client = ScriptedGemini(
            [
                call_response(
                    "get_market_value",
                    {"location": "Dehiwala", "property_type": "land"},
                ),
                text_response(
                    "In Dehiwala, bare land currently asks around LKR 2.6M to 6.5M per perch with a median of 5.5M. "
                    "Actual closing deals usually settle 5% to 10% lower once negotiated. "
                    "Are you looking to buy or sell in Dehiwala?"
                ),
            ]
        )

        reply = run_turn(seeded_market, "conv-advisory-1", "What's land going for in Dehiwala?", client=client)

        assert "LKR 2.6M" in reply
        assert "per perch" in reply
        assert "Are you looking to buy or sell" in reply

        rows = _messages(seeded_market)
        tool_row = next(m for m in rows if m.role is MessageRole.TOOL)
        res = tool_row.tool_payload["function_response"]["response"]

        assert res["suburb"] == "Dehiwala"
        assert res["unit_pricing"]["unit_label"] == "LKR / Perch"
        assert res["unit_pricing"]["min"] == 2600000.0
        assert res["unit_pricing"]["max"] == 6500000.0
        assert "advisory_summary" in res
        assert len(res["sub_areas"]) >= 2

    def test_sub_area_comparison_inquiry(self, seeded_market: Session):
        """User compares two micro-areas: Attidiya vs Kalubowila in Dehiwala."""
        client = ScriptedGemini(
            [
                call_response(
                    "get_market_value",
                    {"location": "Dehiwala", "property_type": "land"},
                ),
                text_response(
                    "Kalubowila commands higher rates with a median around LKR 5.5M per perch, "
                    "while Attidiya is noticeably more accessible with entry prices from LKR 2.6M per perch. "
                    "What type of plot size are you considering?"
                ),
            ]
        )

        reply = run_turn(
            seeded_market,
            "conv-advisory-2",
            "Is Attidiya cheaper than Kalubowila in Dehiwala?",
            client=client,
        )

        assert "Kalubowila" in reply
        assert "Attidiya" in reply
        assert "5.5M" in reply or "2.6M" in reply

        rows = _messages(seeded_market)
        call_row = next(m for m in rows if m.role is MessageRole.ASSISTANT and m.tool_payload)
        assert call_row.tool_payload["function_call"]["name"] == "get_market_value"

    def test_deal_evaluation_inquiry(self, seeded_market: Session):
        """User asks if a specific price on Waidya Road is a good deal."""
        client = ScriptedGemini(
            [
                call_response(
                    "get_market_value",
                    {"location": "Dehiwala", "sub_area": "Waidya Road", "property_type": "land"},
                ),
                text_response(
                    "At LKR 3M per perch on Waidya Road, that would be well below typical asking rates of 6.5M. "
                    "That looks like an attractive deal if the title and access road are clear. "
                    "Would you like an agent to check the pedigree and verify the listing for you?"
                ),
            ]
        )

        reply = run_turn(
            seeded_market,
            "conv-advisory-3",
            "Someone is asking 3M per perch on Waidya Road. Is that a good deal?",
            client=client,
        )

        assert "attractive deal" in reply or "below typical" in reply

        rows = _messages(seeded_market)
        tool_row = next(m for m in rows if m.role is MessageRole.TOOL)
        res = tool_row.tool_payload["function_response"]["response"]
        assert res["sub_area"] == "Waidya Road"
        assert "grading_thresholds" in res

    def test_valuation_inquiry_followed_by_lead_capture_flow(self, seeded_market: Session):
        """Turn 1: User asks for market rates. Turn 2: User gives contact details."""
        # Turn 1: Market inquiry
        client1 = ScriptedGemini(
            [
                call_response(
                    "get_market_value",
                    {"location": "Dehiwala", "sub_area": "Attidiya", "property_type": "land"},
                ),
                text_response(
                    "Attidiya land is currently around LKR 2.6M per perch. "
                    "We have a few direct owner plots there. What's the best number to share details on WhatsApp?"
                ),
            ]
        )
        reply1 = run_turn(
            seeded_market,
            "conv-lead-capture",
            "What's land selling for in Attidiya?",
            client=client1,
        )
        assert "LKR 2.6M" in reply1

        # Turn 2: Lead capture
        client2 = ScriptedGemini(
            [
                call_response(
                    "capture_lead",
                    {
                        "name": "Dinesh Perera",
                        "phone": "0771234567",
                        "intent": "buy",
                        "interest": "land",
                        "requirements": "Looking for land in Attidiya around 2.6M/perch",
                        "remarks": "Interested in direct owner plots in Attidiya",
                    },
                ),
                text_response(
                    "Thanks Dinesh, I've noted that down. An agent will send over our latest Attidiya options to 0771234567 shortly."
                ),
            ]
        )
        reply2 = run_turn(
            seeded_market,
            "conv-lead-capture",
            "I'm Dinesh Perera, call or WhatsApp me on 0771234567",
            client=client2,
        )
        assert "Dinesh" in reply2

        # Verify lead persistence
        lead = seeded_market.execute(select(Lead)).scalar_one()
        assert lead.name == "Dinesh Perera"
        assert lead.phone == "0771234567"
        assert lead.intent.value == "buy"
        assert lead.interest.value == "land"
        assert "Attidiya" in lead.requirements
