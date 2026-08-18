"""Tool declarations and their Python implementations.

The declarations are hand-written `FunctionDeclaration`s — no framework generates them
from signatures, by design. Their `description` strings are prompt text as much as
documentation: they are the only thing the model reads when deciding whether to call.

**The zero-match contract is the load-bearing part of this module.** `search_properties`
never returns a bare empty list. An empty result is the moment the model is most likely to
either invent a listing or tell the user we have nothing in their area, and both are
failures the project owner called out specifically. The system prompt forbids them, but a
payload of `[]` quietly argues the opposite — so the payload carries the instruction with
it. Prompt and tool response have to agree; if they ever disagree, the tool response is
closer to the model's attention and tends to win.

**Coercion is deliberately asymmetric between the two tools.** `flash-lite` sends loose
arguments — `"5 million"`, `"LKR 20,000,000"`, `"villa"` — so both tools have to be
forgiving to be usable. But they are forgiving about different things:

- `search_properties` is *strict* about `property_type`. Silently dropping an
  unrecognised type widens the search, and the user gets shown land when they asked for a
  villa. Better to hand the model an error naming the four valid values and let it retry.
- `capture_lead` is *lenient* about `intent`. The name and phone number are the point of
  the call; refusing to save a real lead over an unrecognised intent tag would trade
  something valuable for something cosmetic.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from google.genai import types
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import queries
from app.models.lead import Lead, LeadIntent
from app.models.property import Property, PropertyType

SEARCH_PROPERTIES = "search_properties"
CAPTURE_LEAD = "capture_lead"

# Repeated to the model in the tool response itself, not just the system prompt. See the
# module docstring for why the duplication is intentional.
NO_MATCH_GUIDANCE = (
    "No published listings match these criteria. Do NOT tell the user we have nothing "
    "in that area or that we don't cover it — our published listings are only part of "
    "what we work with. Say an agent will check what's available, including unpublished "
    "stock, and come back to them. Ask for their name and a phone number so someone can. "
    "Do not invent or describe any property."
)


class ToolArgumentError(ValueError):
    """A tool argument that can't be salvaged.

    Surfaced to the model as a `function_response` it can retry from, never raised out of
    the loop — a chat reply is more useful than a 500.
    """


@dataclass(frozen=True)
class ToolContext:
    """What a tool needs beyond its declared arguments.

    Passed in rather than looked up so tools never open their own session, and so
    `capture_lead` cannot write to a conversation other than the live one — the model
    doesn't get to name the conversation it writes to.
    """

    db: Session
    conversation_id: uuid.UUID


# --------------------------------------------------------------------------------------
# Argument coercion
# --------------------------------------------------------------------------------------

# "18 lakhs", "2 crore" — common in Sri Lankan and Indian price talk, and the model
# repeats whatever the user typed.
_MULTIPLIERS: dict[str, Decimal] = {
    "k": Decimal(1_000),
    "thousand": Decimal(1_000),
    "lakh": Decimal(100_000),
    "lakhs": Decimal(100_000),
    "lac": Decimal(100_000),
    "m": Decimal(1_000_000),
    "mn": Decimal(1_000_000),
    "million": Decimal(1_000_000),
    "crore": Decimal(10_000_000),
    "cr": Decimal(10_000_000),
    "b": Decimal(1_000_000_000),
    "billion": Decimal(1_000_000_000),
}

_MONEY = re.compile(
    r"^(?P<amount>\d+(?:\.\d+)?)\s*(?P<suffix>[a-z]+)?$",
)


def _as_decimal(value: Any, field: str) -> Decimal | None:
    """Money, however the model chose to write it.

    Accepts numbers, plain numeric strings, and the suffixed forms people actually say
    ("48m", "2 crore", "LKR 18,500,000"). Anything left unrecognised raises rather than
    silently becoming zero — a budget of 0 would match nothing and look like empty stock,
    which is precisely the failure mode this feature is built to avoid.
    """
    if value is None or value == "":
        return None
    if isinstance(value, bool):  # bool is an int subclass; nobody means this
        raise ToolArgumentError(f"{field} must be a number, got a boolean")
    if isinstance(value, (int, float, Decimal)):
        amount = Decimal(str(value))
        return amount if amount > 0 else None

    text = str(value).strip().lower()
    for noise in ("lkr", "rs.", "rs", "rupees", ",", "_"):
        text = text.replace(noise, "")
    text = text.strip()
    if not text:
        return None

    match = _MONEY.match(text)
    if match is None:
        raise ToolArgumentError(
            f"{field} could not be read as an amount: {value!r}. "
            "Use a plain number of rupees, e.g. 48000000."
        )
    try:
        amount = Decimal(match.group("amount"))
    except InvalidOperation as exc:  # pragma: no cover - regex already constrains this
        raise ToolArgumentError(f"{field} is not a number: {value!r}") from exc

    suffix = match.group("suffix")
    if suffix:
        if suffix not in _MULTIPLIERS:
            raise ToolArgumentError(
                f"{field} has an unrecognised unit {suffix!r}. "
                "Use a plain number of rupees, e.g. 48000000."
            )
        amount *= _MULTIPLIERS[suffix]

    return amount if amount > 0 else None


def _as_int(value: Any, field: str) -> int | None:
    """A count, or None.

    Zero and negatives collapse to None — "unspecified" — rather than erroring. A model
    that sends `bedrooms=0` means "didn't ask", and refusing the whole search over it
    would cost the user a real answer. Contrast `_as_property_type`, where the same
    leniency would change what gets shown.
    """
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ToolArgumentError(f"{field} must be a number, got a boolean")
    try:
        number = int(float(str(value).strip()))
    except (TypeError, ValueError) as exc:
        raise ToolArgumentError(f"{field} is not a whole number: {value!r}") from exc
    return number if number > 0 else None


def _as_property_type(value: Any) -> PropertyType | None:
    """Strict on purpose — see the module docstring."""
    if value is None or value == "":
        return None
    text = str(value).strip().lower().rstrip("s")  # "apartments" -> "apartment"
    aliases = {"flat": "apartment", "condo": "apartment", "shop": "commercial"}
    text = aliases.get(text, text)
    try:
        return PropertyType(text)
    except ValueError as exc:
        valid = ", ".join(member.value for member in PropertyType)
        raise ToolArgumentError(
            f"property_type must be one of: {valid}. Got {value!r}. "
            "Pick the closest one and search again."
        ) from exc


def _as_intent(value: Any) -> LeadIntent | None:
    """Lenient on purpose — an unreadable intent tag must not cost us the lead."""
    if value is None or value == "":
        return None
    text = str(value).strip().lower()
    aliases = {
        "buying": "buy",
        "buyer": "buy",
        "purchase": "buy",
        "renting": "rent",
        "renter": "rent",
        "rental": "rent",
        "lease": "rent",
        "selling": "sell",
        "seller": "sell",
        "sale": "sell",
        "list": "sell",
    }
    try:
        return LeadIntent(aliases.get(text, text))
    except ValueError:
        return None


def _clean_text(value: Any, limit: int) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text[:limit] or None


# --------------------------------------------------------------------------------------
# Serialization
# --------------------------------------------------------------------------------------


def _serialize(prop: Property) -> dict[str, Any]:
    """One listing, as the model should see it.

    `price` is an `int`: `Numeric(14, 2)` can hold cents but no Colombo listing is priced
    to the rupee, and a Decimal is not JSON-serialisable — this payload gets stored in
    `messages.tool_payload` as well as sent to Gemini.

    `id` travels so a future `get_property_details` has something to take, and so the
    model can refer to a listing without us matching on title.
    """
    return {
        "id": str(prop.id),
        "title": prop.title,
        "location": prop.location,
        "price_lkr": int(prop.price),
        "property_type": prop.property_type.value,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "sqft": prop.sqft,
        "description": prop.description,
    }


# --------------------------------------------------------------------------------------
# Implementations
# --------------------------------------------------------------------------------------


def search_properties(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Find listings matching the criteria the model extracted from the conversation."""
    budget_min = _as_decimal(args.get("budget_min"), "budget_min")
    budget_max = _as_decimal(args.get("budget_max"), "budget_max")
    # A model that transposes these would otherwise get a guaranteed-empty range and read
    # it as "no stock", then tell the user so.
    if budget_min is not None and budget_max is not None and budget_min > budget_max:
        budget_min, budget_max = budget_max, budget_min

    matches = queries.search_properties(
        context.db,
        location=_clean_text(args.get("location"), 120),
        budget_min=budget_min,
        budget_max=budget_max,
        property_type=_as_property_type(args.get("property_type")),
        bedrooms=_as_int(args.get("bedrooms"), "bedrooms"),
    )

    payload: dict[str, Any] = {
        "match_count": len(matches),
        "matches": [_serialize(prop) for prop in matches],
    }
    if not matches:
        payload["guidance"] = NO_MATCH_GUIDANCE
    return payload


def capture_lead(context: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    """Create or update this conversation's lead.

    An update, not an insert, on every call after the first — `leads.conversation_id` is
    UNIQUE, so a second insert would raise. Fields are merged rather than overwritten: a
    later call that only carries a phone number must not wipe the name an earlier one
    captured, because the model re-sends whatever it happens to be holding.
    """
    name = _clean_text(args.get("name"), 120)
    phone = _clean_text(args.get("phone"), 40)
    preferences = _clean_text(args.get("preferences"), 4000)
    intent = _as_intent(args.get("intent"))
    budget_min = _as_decimal(args.get("budget_min"), "budget_min")
    budget_max = _as_decimal(args.get("budget_max"), "budget_max")
    if budget_min is not None and budget_max is not None and budget_min > budget_max:
        budget_min, budget_max = budget_max, budget_min

    # Nothing worth keeping. Writing an all-NULL row would leave a lead nobody can follow
    # up, indistinguishable from a real one that lost its details.
    if not any([name, phone, preferences, intent, budget_min, budget_max]):
        return {
            "saved": False,
            "reason": "Nothing to save yet — no name, phone, preferences, or intent.",
            "guidance": (
                "Keep helping and ask for a name and phone number once you've given them "
                "something useful. Don't call this tool again until you have one of them."
            ),
        }

    lead = context.db.execute(
        select(Lead).where(Lead.conversation_id == context.conversation_id)
    ).scalar_one_or_none()

    created = lead is None
    if lead is None:
        lead = Lead(conversation_id=context.conversation_id)
        context.db.add(lead)

    if name:
        lead.name = name
    if phone:
        lead.phone = phone
    if preferences:
        lead.preferences = preferences
    if intent is not None:
        lead.intent = intent
    if budget_min is not None:
        lead.budget_min = budget_min
    if budget_max is not None:
        lead.budget_max = budget_max

    context.db.flush()

    still_missing = [
        field
        for field, value in (("name", lead.name), ("phone", lead.phone))
        if not value
    ]
    return {
        "saved": True,
        "created": created,
        "lead": {
            "name": lead.name,
            "phone": lead.phone,
            "intent": lead.intent.value if lead.intent else None,
            "budget_min": int(lead.budget_min) if lead.budget_min else None,
            "budget_max": int(lead.budget_max) if lead.budget_max else None,
        },
        "still_missing": still_missing,
    }


IMPLEMENTATIONS = {
    SEARCH_PROPERTIES: search_properties,
    CAPTURE_LEAD: capture_lead,
}


def execute_tool(
    name: str, args: dict[str, Any], context: ToolContext
) -> dict[str, Any]:
    """Run a tool by name, converting every failure into a payload the model can read.

    Nothing raises out of here. An unknown tool name, a bad argument, or an unexpected
    exception all come back as `{"error": ...}`, because the loop's job is to keep the
    conversation going — a stack trace reaching the user is a worse outcome than a turn
    the model has to retry.
    """
    implementation = IMPLEMENTATIONS.get(name)
    if implementation is None:
        return {
            "error": f"Unknown tool {name!r}.",
            "available_tools": sorted(IMPLEMENTATIONS),
        }
    try:
        return implementation(context, args or {})
    except ToolArgumentError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001 - deliberate catch-all; see docstring
        return {
            "error": f"{name} failed: {type(exc).__name__}.",
            "guidance": (
                "Don't retry this call. Apologise briefly, keep helping, and offer to have "
                "an agent follow up."
            ),
        }


# --------------------------------------------------------------------------------------
# Declarations
# --------------------------------------------------------------------------------------

_SEARCH_DECLARATION = types.FunctionDeclaration(
    name=SEARCH_PROPERTIES,
    description=(
        "Search Home Advisor's published property listings. Call this once you know "
        "roughly what the person wants — every parameter is optional, and omitting one "
        "widens the search rather than narrowing it. Returns up to 5 available listings. "
        "If it returns no matches, that means nothing is published matching those "
        "criteria; it does NOT mean we don't cover the area, and you must not say so."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "location": types.Schema(
                type=types.Type.STRING,
                description=(
                    "Area or city, matched as a substring: 'Colombo 5', 'Rajagiriya', "
                    "'Galle'. Use 'Colombo' to cover every Colombo suburb."
                ),
            ),
            "budget_min": types.Schema(
                type=types.Type.NUMBER,
                description="Lowest acceptable price in LKR, as a plain number.",
            ),
            "budget_max": types.Schema(
                type=types.Type.NUMBER,
                description="Highest acceptable price in LKR, as a plain number.",
            ),
            "property_type": types.Schema(
                type=types.Type.STRING,
                enum=[member.value for member in PropertyType],
                description="One of: house, apartment, land, commercial.",
            ),
            "bedrooms": types.Schema(
                type=types.Type.INTEGER,
                description="Minimum bedrooms; listings with more are included.",
            ),
        },
    ),
)

_CAPTURE_DECLARATION = types.FunctionDeclaration(
    name=CAPTURE_LEAD,
    description=(
        "Save this person's contact details and what they're looking for, so an agent can "
        "follow up. Call it as soon as you have a name or a phone number — a partial "
        "record is useful and you can call again to add more; later calls update the same "
        "record instead of creating a second one. Never invent a detail to fill a field: "
        "omit what you weren't told."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "name": types.Schema(type=types.Type.STRING, description="Their name."),
            "phone": types.Schema(
                type=types.Type.STRING,
                description="Phone number, exactly as they gave it.",
            ),
            "intent": types.Schema(
                type=types.Type.STRING,
                enum=[member.value for member in LeadIntent],
                description=(
                    "'buy' or 'rent' if they're looking for a property, 'sell' if they "
                    "want us to sell or let out theirs."
                ),
            ),
            "budget_min": types.Schema(
                type=types.Type.NUMBER,
                description="Bottom of their budget in LKR, if mentioned.",
            ),
            "budget_max": types.Schema(
                type=types.Type.NUMBER,
                description="Top of their budget in LKR, if mentioned.",
            ),
            "preferences": types.Schema(
                type=types.Type.STRING,
                description=(
                    "Short free-text summary an agent can act on: areas, property type, "
                    "timing, and — for a seller — the property's location, type, and "
                    "rough size."
                ),
            ),
        },
    ),
)

# One Tool holding both declarations, which is what GenerateContentConfig(tools=...) wants.
TOOL_DECLARATIONS: list[types.Tool] = [
    types.Tool(function_declarations=[_SEARCH_DECLARATION, _CAPTURE_DECLARATION])
]
