"""`search_properties` and `capture_lead`.

The headline test in here is `TestZeroMatches` — the contract that a search finding nothing
still tells the model not to claim we have nothing. Everything else guards the coercion
that makes these tools survive `flash-lite`'s loose arguments.
"""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import tools
from app.agent.tools import ToolArgumentError, ToolContext
from app.models import Conversation, Lead, LeadIntent, PropertyType


def _context(session: Session, session_id: str = "tool-sess") -> ToolContext:
    conversation = Conversation(session_id=session_id)
    session.add(conversation)
    session.flush()
    return ToolContext(db=session, conversation_id=conversation.id)


class TestSearch:
    def test_no_criteria_returns_available_listings(self, seeded: Session):
        result = tools.search_properties(_context(seeded), {})
        assert result["match_count"] == 5, "capped at 5 even though 8 are seeded"
        assert "guidance" not in result

    def test_location_is_case_insensitive_substring(self, seeded: Session):
        result = tools.search_properties(_context(seeded), {"location": "colombo"})
        assert result["match_count"] > 1
        assert all("Colombo" in m["location"] for m in result["matches"])

    def test_budget_max_excludes_dearer_listings(self, seeded: Session):
        result = tools.search_properties(_context(seeded), {"budget_max": 50_000_000})
        assert result["match_count"] > 0
        assert all(m["price_lkr"] <= 50_000_000 for m in result["matches"])

    def test_bedrooms_is_a_floor_not_an_exact_match(self, seeded: Session):
        result = tools.search_properties(_context(seeded), {"bedrooms": 4})
        assert result["match_count"] > 0
        assert all(m["bedrooms"] >= 4 for m in result["matches"])

    def test_transposed_budget_is_swapped_rather_than_matching_nothing(
        self, seeded: Session
    ):
        """min > max is an impossible range, and the model would read the empty result as
        empty stock and then tell the user so."""
        swapped = tools.search_properties(
            _context(seeded), {"budget_min": 90_000_000, "budget_max": 40_000_000}
        )
        assert swapped["match_count"] > 0
        assert "guidance" not in swapped

    def test_price_is_json_safe(self, seeded: Session):
        """`tool_payload` is a JSON column and this payload goes to Gemini — a Decimal
        would break both."""
        result = tools.search_properties(_context(seeded), {})
        assert all(isinstance(m["price_lkr"], int) for m in result["matches"])

    def test_sold_listings_are_never_returned(self, seeded: Session):
        from app.models import Property, PropertyStatus

        for prop in seeded.execute(select(Property)).scalars():
            prop.status = PropertyStatus.SOLD
        seeded.flush()

        result = tools.search_properties(_context(seeded), {})
        assert result["match_count"] == 0


class TestZeroMatches:
    """The regression guard the project owner asked for specifically.

    A bare `[]` invites "no results found" regardless of what the system prompt says, so
    the payload has to carry the instruction with it. This is the *automated half* of the
    truthfulness criterion — that the tool never contradicts the prompt. Whether the model
    then obeys is a manual check against live `flash-lite`; the fake supplies reply text.
    """

    def test_unmatched_location_returns_guidance_not_a_bare_empty_list(
        self, seeded: Session
    ):
        result = tools.search_properties(_context(seeded), {"location": "Jaffna"})
        assert result["matches"] == []
        assert result["match_count"] == 0
        assert result["guidance"], "an empty result must never travel without guidance"

    def test_guidance_forbids_denying_coverage(self, seeded: Session):
        result = tools.search_properties(_context(seeded), {"location": "Jaffna"})
        guidance = result["guidance"].lower()
        assert "do not tell the user we have nothing" in guidance
        assert "unpublished" in guidance
        assert "do not invent" in guidance

    def test_no_land_is_seeded_so_type_search_is_also_empty(self, seeded: Session):
        """Every seeded listing is a house or an apartment, which makes `land` a reliable
        zero-match input for this and for the live check."""
        result = tools.search_properties(_context(seeded), {"property_type": "land"})
        assert result["matches"] == []
        assert result["guidance"]

    def test_empty_table_still_returns_guidance(self, db_session: Session):
        result = tools.search_properties(_context(db_session), {})
        assert result["matches"] == []
        assert result["guidance"]


class TestCoercion:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("48m", Decimal(48_000_000)),
            ("48 million", Decimal(48_000_000)),
            ("2 crore", Decimal(20_000_000)),
            ("18 lakhs", Decimal(1_800_000)),
            ("LKR 18,500,000", Decimal(18_500_000)),
            ("250k", Decimal(250_000)),
            (250_000, Decimal(250_000)),
            (None, None),
            ("", None),
        ],
    )
    def test_money_forms_the_model_actually_sends(self, raw, expected):
        assert tools._as_decimal(raw, "budget_max") == expected

    def test_unreadable_budget_raises_rather_than_becoming_zero(self):
        """A budget silently coerced to 0 matches nothing and looks like empty stock."""
        with pytest.raises(ToolArgumentError):
            tools._as_decimal("about tree fiddy", "budget_max")

    def test_unknown_property_type_is_rejected_with_the_valid_values(self, seeded: Session):
        """Strict on purpose: silently dropping the filter shows land to someone who asked
        for a villa."""
        result = tools.execute_tool(
            tools.SEARCH_PROPERTIES, {"property_type": "villa"}, _context(seeded)
        )
        assert "error" in result
        assert "house" in result["error"] and "apartment" in result["error"]

    def test_plural_and_alias_types_are_understood(self):
        assert tools._as_property_type("apartments") is PropertyType.APARTMENT
        assert tools._as_property_type("flat") is PropertyType.APARTMENT

    def test_zero_bedrooms_means_unspecified_not_an_error(self):
        assert tools._as_int(0, "bedrooms") is None
        assert tools._as_int(-3, "bedrooms") is None

    def test_currency_words_alone_mean_nothing_given(self):
        assert tools._as_decimal("LKR", "budget_max") is None

    def test_unrecognised_unit_is_rejected(self):
        with pytest.raises(ToolArgumentError, match="unrecognised unit"):
            tools._as_decimal("48 bushels", "budget_max")

    @pytest.mark.parametrize("field", ["budget_max", "bedrooms"])
    def test_booleans_are_rejected_rather_than_read_as_1(self, field: str):
        """`bool` is an `int` subclass, so `True` would quietly become a budget of 1."""
        coerce = tools._as_decimal if field == "budget_max" else tools._as_int
        with pytest.raises(ToolArgumentError, match="boolean"):
            coerce(True, field)

    def test_worded_bedroom_count_is_rejected(self):
        with pytest.raises(ToolArgumentError, match="whole number"):
            tools._as_int("three", "bedrooms")


class TestCaptureLead:
    def test_creates_a_lead(self, db_session: Session):
        context = _context(db_session)
        result = tools.capture_lead(
            context, {"name": "Nimal Perera", "phone": "0771234567", "intent": "buy"}
        )
        assert result["saved"] is True
        assert result["created"] is True
        assert result["still_missing"] == []

        lead = db_session.execute(select(Lead)).scalar_one()
        assert lead.name == "Nimal Perera"
        assert lead.intent is LeadIntent.BUY

    def test_second_call_updates_rather_than_duplicating(self, db_session: Session):
        """`leads.conversation_id` is UNIQUE, so a second insert would raise. The model
        re-calls this tool freely as it learns more."""
        context = _context(db_session)
        tools.capture_lead(context, {"name": "Nimal Perera"})
        second = tools.capture_lead(context, {"phone": "0771234567"})

        assert second["created"] is False
        assert db_session.execute(select(Lead)).scalars().all().__len__() == 1

    def test_later_call_does_not_blank_an_earlier_field(self, db_session: Session):
        context = _context(db_session)
        tools.capture_lead(context, {"name": "Nimal Perera", "phone": "0771234567"})
        tools.capture_lead(context, {"preferences": "Wants Colombo 5, 3 beds"})

        lead = db_session.execute(select(Lead)).scalar_one()
        assert lead.name == "Nimal Perera", "the name must survive a preferences-only call"
        assert lead.phone == "0771234567"
        assert lead.preferences == "Wants Colombo 5, 3 beds"

    def test_nothing_useful_writes_no_row(self, db_session: Session):
        """An all-NULL lead is indistinguishable from a real one that lost its details."""
        result = tools.capture_lead(_context(db_session), {"name": "", "phone": None})
        assert result["saved"] is False
        assert db_session.execute(select(Lead)).scalars().all() == []
        assert "guidance" in result

    def test_seller_intent_is_recorded_structurally(self, db_session: Session):
        """The whole reason `leads.intent` exists — "show me the sellers" shouldn't be a
        substring search over prose."""
        context = _context(db_session)
        tools.capture_lead(
            context,
            {
                "name": "Ayesha",
                "phone": "0712223334",
                "intent": "selling",
                "preferences": "12 perch house in Battaramulla",
            },
        )
        lead = db_session.execute(
            select(Lead).where(Lead.intent == LeadIntent.SELL)
        ).scalar_one()
        assert lead.name == "Ayesha"

    def test_unreadable_intent_does_not_cost_the_lead(self, db_session: Session):
        """Lenient where search is strict: the phone number matters, the tag doesn't."""
        result = tools.capture_lead(
            _context(db_session), {"phone": "0771234567", "intent": "wibble"}
        )
        assert result["saved"] is True
        assert result["lead"]["intent"] is None

    def test_partial_lead_reports_what_is_missing(self, db_session: Session):
        result = tools.capture_lead(_context(db_session), {"phone": "0771234567"})
        assert result["still_missing"] == ["name"]

    def test_budget_is_recorded_and_transposed_bounds_are_swapped(self, db_session: Session):
        result = tools.capture_lead(
            _context(db_session),
            {"phone": "0771234567", "budget_min": "60m", "budget_max": "40m"},
        )
        assert result["lead"]["budget_min"] == 40_000_000
        assert result["lead"]["budget_max"] == 60_000_000

    def test_lead_is_scoped_to_the_conversation_not_chosen_by_the_model(
        self, db_session: Session
    ):
        """`conversation_id` comes from `ToolContext`, never from the model's arguments, so
        one conversation cannot overwrite another's lead."""
        first = _context(db_session, "sess-a")
        second = _context(db_session, "sess-b")
        tools.capture_lead(first, {"name": "First"})
        tools.capture_lead(second, {"name": "Second"})

        leads = db_session.execute(select(Lead)).scalars().all()
        assert {lead.name for lead in leads} == {"First", "Second"}


class TestExecuteTool:
    def test_unknown_tool_returns_an_error_the_model_can_read(self, db_session: Session):
        result = tools.execute_tool("book_a_viewing", {}, _context(db_session))
        assert "error" in result
        assert result["available_tools"] == ["capture_lead", "search_properties"]

    def test_bad_arguments_do_not_raise_out_of_the_tool_layer(self, seeded: Session):
        """The loop must be able to keep the conversation going; a 500 is a worse outcome
        than a turn the model retries."""
        result = tools.execute_tool(
            tools.SEARCH_PROPERTIES, {"budget_max": "loads"}, _context(seeded)
        )
        assert "error" in result

    def test_an_unexpected_exception_becomes_a_payload_not_a_crash(
        self, db_session: Session, monkeypatch: pytest.MonkeyPatch
    ):
        """A database blip mid-tool shouldn't take the whole chat turn down with it."""

        def exploding(_context, _args):
            raise RuntimeError("Neon went for a nap")

        monkeypatch.setitem(tools.IMPLEMENTATIONS, tools.SEARCH_PROPERTIES, exploding)
        result = tools.execute_tool(tools.SEARCH_PROPERTIES, {}, _context(db_session))

        assert "RuntimeError" in result["error"]
        assert "Don't retry" in result["guidance"]
        assert "Neon went for a nap" not in result["error"], (
            "internal failure text must not reach the model, and through it the user"
        )


class TestDeclarations:
    def test_both_tools_are_declared(self):
        names = {
            declaration.name
            for tool in tools.TOOL_DECLARATIONS
            for declaration in tool.function_declarations
        }
        assert names == {"search_properties", "capture_lead"}

    def test_search_declaration_warns_the_model_about_empty_results(self):
        declaration = next(
            d
            for tool in tools.TOOL_DECLARATIONS
            for d in tool.function_declarations
            if d.name == "search_properties"
        )
        assert "does NOT mean we don't cover the area" in declaration.description

    def test_every_declared_name_has_an_implementation(self):
        names = {
            declaration.name
            for tool in tools.TOOL_DECLARATIONS
            for declaration in tool.function_declarations
        }
        assert names == set(tools.IMPLEMENTATIONS)
