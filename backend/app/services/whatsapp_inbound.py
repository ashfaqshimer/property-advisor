"""WhatsApp inbound message processor and property/lead ingestion service.

Extracts real estate details from inbound WhatsApp messages (text, forwards, etc.),
creates or updates Prospect and Lead records, alerts staff via Telegram, and dispatches
an automated confirmation via WhatsApp.
"""

from decimal import Decimal
import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.client import get_gemini_extractor_client
from app.models.lead import Lead, LeadIntent, LeadInterest, LeadSource
from app.models.prospect import Prospect
from app.schemas.extractor import ExtractedPropertyDraft, GeminiPropertyExtraction
from app.services.extraction_cleaner import clean_and_build_draft, normalize_phone_number
from app.services.notifications import send_lead_alert
from app.services.whatsapp_client import WhatsAppClient

logger = structlog.get_logger(__name__)

EXTRACTION_PROMPT_TEMPLATE = """
You are an expert real estate data extractor for Sri Lankan properties.
Extract a structured real estate listing from the provided unstructured WhatsApp message.
The input text may be written in English, Sinhala (සිංහල script), Singlish (Sinhala written in Latin script), or a blend.

Unstructured Input:
\"\"\"{raw_text}\"\"\"

Instructions:
1. Language & Output:
   - Generate 'title' and 'description' in polished, professional English suitable for a Colombo-focused real estate catalog.
   - Title should be concise and descriptive (e.g. "Prime 3-Bedroom House in Dehiwala", "Luxury Apartment for Rent in Colombo 3").
   - Description should be well-written English omitting chat noise. Standardize price references to millions or thousands (e.g. "35M LKR", "160 Million LKR").
   - 'location': Extract the primary Sri Lankan town, city, or Colombo suburb in English (e.g. "Dehiwala", "Homagama", "Colombo 3", "Kollupitiya", "Rajagiriya", "Nugegoda", "Battaramulla", "Malabe").

2. Sri Lankan Currency & Price Conversion:
   - Convert all prices into standard numerical LKR values.
   - "ලක්ෂ" / "Lakh" / "Laksha" / "Laks": 1 Lakh = 100,000 LKR.
   - "කෝටි" / "Koti" / "Crore": 1 Koti = 10,000,000 LKR (10 Million).
   - "මිලියන" / "Million" / "M" / "Mn": 1 Million = 1,000,000 LKR.
   - Price per perch: If stated per perch (e.g., "15 lakhs per perch", "1.5M pp"), set is_price_per_perch = True, price = per-perch amount.
   - Rent: If for rent / lease, set listing_type = 'rent', price = monthly rent.
   - If price is omitted or purely "call for price", set price = None.

3. Property & Listing Type:
   - property_type: 'mixed_use', 'commercial', 'apartment', 'house', 'land'.
   - listing_type: 'sale' or 'rent'.

4. Specifications:
   - bedrooms, bathrooms, floor_area_sqft, land_size_perches, parking_spaces, build_year, road_access_ft, furnishing_status.

5. Amenities & Highlights:
   - Extract amenities (ac, pool, garden, gym, generator, security, three_phase_electricity, etc.).
   - has_maids_room, has_maids_toilet, is_gated_community.

6. Contact:
   - contact_name: Name of owner or agent if mentioned.
   - contact_phone: Phone number if mentioned in message text.
   - contact_type: "owner", "broker", or None.
"""


def extract_property_details(raw_text: str) -> ExtractedPropertyDraft | None:
    """Invoke Gemini to extract structured property draft from raw message text."""
    if not raw_text or len(raw_text.strip()) < 10:
        return None

    try:
        extractor = get_gemini_extractor_client()
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(raw_text=raw_text.strip())
        raw_draft = extractor.generate_structured(prompt=prompt, schema=GeminiPropertyExtraction)
        return clean_and_build_draft(raw_draft, raw_text=raw_text)
    except Exception as exc:
        logger.exception("whatsapp_extraction_failed", error=str(exc))
        return None


def process_inbound_whatsapp_message(
    db: Session,
    sender_phone: str,
    message_text: str,
    message_id: str | None = None,
    whatsapp_client: WhatsAppClient | None = None,
) -> dict:
    """Process an incoming WhatsApp message from a potential seller or landlord."""
    clean_sender = normalize_phone_number(sender_phone) or sender_phone
    logger.info(
        "processing_inbound_whatsapp",
        sender=clean_sender,
        message_id=message_id,
        text_length=len(message_text),
    )

    client = whatsapp_client or WhatsAppClient()
    draft = extract_property_details(message_text)

    # If message is too short or doesn't resemble a listing:
    if not draft or not (draft.title or draft.location):
        reply_text = (
            "Hello! Thank you for contacting Property Advisor Sri Lanka 🏡.\n\n"
            "If you are looking to sell or rent out a property, please reply with details "
            "such as the location, property type, price, bedrooms/land size, and contact details. "
            "Our team will review and connect you with qualified buyers!"
        )
        if client.is_configured:
            client.send_text_message(to_phone=clean_sender, message=reply_text)
        return {"status": "unrecognized_or_greeting", "prospect_id": None, "lead_id": None}

    # 1. Determine contact phone (prefer explicit phone in message, fallback to WhatsApp sender)
    poster_phone = draft.contact_phone or clean_sender
    poster_name = draft.contact_name or "WhatsApp Seller"

    # 2. Check for duplicate prospect by source and source_id
    prospect_source_id = f"wa_{message_id}" if message_id else None
    existing_prospect = None
    if prospect_source_id:
        existing_prospect = db.execute(
            select(Prospect).where(
                Prospect.source == "whatsapp",
                Prospect.source_id == prospect_source_id,
            )
        ).scalar_one_or_none()

    if existing_prospect:
        logger.info("whatsapp_prospect_already_processed", prospect_id=str(existing_prospect.id))
        return {
            "status": "already_processed",
            "prospect_id": str(existing_prospect.id),
            "lead_id": None,
        }

    # 3. Create Prospect record
    prospect = Prospect(
        source="whatsapp",
        source_id=prospect_source_id,
        source_url=None,
        title=draft.title or f"Property in {draft.location or 'Colombo'}",
        price=str(draft.price) if draft.price else "Call for Price",
        price_numeric=Decimal(str(draft.price)) if draft.price else None,
        is_price_per_perch=bool(draft.is_price_per_perch),
        land_size_perches=Decimal(str(draft.land_size_perches)) if draft.land_size_perches else None,
        floor_area_sqft=draft.floor_area_sqft,
        bedrooms=draft.bedrooms,
        bathrooms=draft.bathrooms,
        location=draft.location or "Colombo",
        suburb=draft.location,
        suburb_source="whatsapp_inbound",
        property_type=(draft.property_type.value if hasattr(draft.property_type, "value") else str(draft.property_type or "house")),
        listing_type=(draft.listing_type.value if hasattr(draft.listing_type, "value") else str(draft.listing_type or "sale")),
        poster_name=poster_name,
        phone_number=poster_phone,
        classification="owner" if draft.contact_type == "owner" else ("broker" if draft.contact_type == "broker" else "unknown"),
        confidence=90 if draft.contact_type == "owner" else 70,
        classification_reasons=["whatsapp_inbound_submission"],
        classification_method="llm",
        status="new",
    )
    db.add(prospect)
    db.flush()

    # 4. Create or update Lead record
    lead_intent = LeadIntent.RENT if draft.listing_type and "rent" in str(draft.listing_type).lower() else LeadIntent.SELL
    prop_type_str = str(draft.property_type).lower() if draft.property_type else ""
    lead_interest = LeadInterest.SELLING
    if "apartment" in prop_type_str:
        lead_interest = LeadInterest.APARTMENT_RENT if lead_intent == LeadIntent.RENT else LeadInterest.APARTMENT_SALE
    elif "house" in prop_type_str:
        lead_interest = LeadInterest.HOUSE_RENT if lead_intent == LeadIntent.RENT else LeadInterest.HOUSE_SALE
    elif "land" in prop_type_str:
        lead_interest = LeadInterest.LAND

    lead = Lead(
        name=poster_name,
        phone=poster_phone,
        intent=lead_intent,
        interest=lead_interest,
        source=LeadSource.MANUAL,  # Inbound channel
        requirements=f"Listed via WhatsApp: {draft.title} in {draft.location}",
        remarks=f"WhatsApp Inbound submission. Message: {message_text[:200]}...",
        budget_min=Decimal(str(draft.price)) if draft.price else None,
        budget_max=Decimal(str(draft.price)) if draft.price else None,
    )
    db.add(lead)
    db.commit()
    db.refresh(prospect)
    db.refresh(lead)

    # 5. Send Internal Alert to Telegram
    try:
        send_lead_alert(
            name=f"{poster_name} (WA Inbound)",
            phone=poster_phone,
            intent=lead_intent.value,
            interest=lead_interest.value,
            budget_min=lead.budget_min,
            budget_max=lead.budget_max,
            requirements=draft.title,
            remarks=f"Location: {draft.location} | Suburb: {draft.location}\nRaw: {message_text[:120]}...",
            source="whatsapp_inbound",
            sync=False,
        )
    except Exception as exc:
        logger.warning("whatsapp_telegram_alert_failed", error=str(exc))

    # 6. Send Outbound Auto-Reply via WhatsApp
    location_str = f" in {draft.location}" if draft.location else ""
    confirmation_reply = (
        f"Thank you! Property Advisor has received your listing for *{draft.title}*{location_str} 🏡.\n\n"
        "Our Colombo property advisory team will review the details and reach out to you shortly."
    )
    if client.is_configured:
        client.send_text_message(to_phone=clean_sender, message=confirmation_reply)

    return {
        "status": "success",
        "prospect_id": str(prospect.id),
        "lead_id": str(lead.id),
        "title": draft.title,
        "location": draft.location,
    }
