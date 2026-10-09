"""Post-processing and normalization service for property extraction.

Ensures extracted data from Gemini (or scraped prospect text) is robustly normalized,
handles missing fields gracefully, extracts phone numbers reliably (with Sri Lankan
format normalization and regex fallback), and standardizes amenities to match the frontend catalog.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from app.models.property import ListingType, PropertyType
from app.schemas.extractor import ExtractedPropertyDraft, GeminiPropertyExtraction


# Canonical mapping from common amenity names / synonyms / Sinhala romanizations to frontend keys
AMENITY_CANONICAL_MAP: dict[str, str] = {
    # Air conditioning
    "ac": "ac",
    "a/c": "ac",
    "air_condition": "ac",
    "air_conditioning": "ac",
    "air conditioning": "ac",
    "air conditioned": "ac",
    "air_conditioned": "ac",
    "air conditioner": "ac",
    "ac rooms": "ac",
    # Swimming pool
    "pool": "pool",
    "swimming_pool": "pool",
    "swimming pool": "pool",
    # Garden
    "garden": "garden",
    "landscaped_garden": "garden",
    "landscaped garden": "garden",
    "lawn": "garden",
    # Gym
    "gym": "gym",
    "gymnasium": "gym",
    "fitness": "gym",
    "fitness center": "gym",
    # Generator / Backup power
    "generator": "generator",
    "power_backup": "generator",
    "power backup": "generator",
    "backup_generator": "generator",
    "backup generator": "generator",
    # Security
    "security": "security",
    "24/7 security": "security",
    "security guard": "security",
    "guard": "security",
    # Three-Phase Electricity
    "three_phase_electricity": "three_phase_electricity",
    "three_phase": "three_phase_electricity",
    "three phase": "three_phase_electricity",
    "three phase power": "three_phase_electricity",
    "three phase electricity": "three_phase_electricity",
    "3_phase": "three_phase_electricity",
    "3 phase": "three_phase_electricity",
    "3-phase": "three_phase_electricity",
    "tekala widuliya": "three_phase_electricity",
    "tekala viduliya": "three_phase_electricity",
    # Well water
    "well_water": "well_water",
    "well water": "well_water",
    "well": "well_water",
    "tube well": "well_water",
    "lin jalaya": "well_water",
    # Boundary wall
    "boundary_wall": "boundary_wall",
    "boundary wall": "boundary_wall",
    "parapet wall": "boundary_wall",
    "parapet_wall": "boundary_wall",
    "thappa": "boundary_wall",
    "wata thappa": "boundary_wall",
    # Clear deeds
    "clear_deeds": "clear_deeds",
    "clear deeds": "clear_deeds",
    "clear_deed": "clear_deeds",
    "clear deed": "clear_deeds",
    "sinnakkara": "clear_deeds",
    "sinnakkara oppu": "clear_deeds",
    "bim sawiya": "clear_deeds",
    # CCTV
    "cctv": "cctv",
    "cctv camera": "cctv",
    "cctv cameras": "cctv",
    "surveillance": "cctv",
    # Wi-Fi / Internet
    "wifi": "wifi",
    "wi-fi": "wifi",
    "internet": "wifi",
    "fiber": "wifi",
    "fibre": "wifi",
    # Hot water
    "hot_water": "hot_water",
    "hot water": "hot_water",
    "solar hot water": "hot_water",
    "geyser": "hot_water",
}

# Regex to detect Sri Lankan phone numbers in unstructured text
# Matches numbers like: +94 77 123 4567, 077-1234567, 071 987 6543, 011 234 5678, 771234567
_LK_PHONE_REGEX = re.compile(
    r"(?:(?:\+?94)|0)?[\s.-]?[1-9]\d{1,2}(?:[\s.-]?\d){6,7}\b"
)


def normalize_phone_number(raw: str) -> str | None:
    """Standardize a single phone number into local Sri Lankan format (e.g. '0771234567' or '0112345678')."""
    if not raw:
        return None

    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None

    # Handle international Sri Lanka prefix: +94 -> 0
    if digits.startswith("94") and len(digits) in (11, 12):
        digits = "0" + digits[2:]

    # Handle 9-digit local mobile or landline without leading zero (e.g. 771234567 -> 0771234567)
    if len(digits) == 9 and digits[0] in "123456789":
        digits = "0" + digits

    # Valid Sri Lankan phone number is typically 10 digits starting with 0
    if len(digits) == 10 and digits.startswith("0"):
        return digits

    # If it's a non-standard length but looks like a phone number (e.g. 7-11 digits), return digits
    if 7 <= len(digits) <= 12:
        return digits

    return None


def extract_phones_from_text(text: str) -> list[str]:
    """Extract and normalize all unique Sri Lankan phone numbers found in freeform text."""
    if not text:
        return []

    found: list[str] = []
    for match in _LK_PHONE_REGEX.finditer(text):
        normalized = normalize_phone_number(match.group(0))
        if normalized and normalized not in found:
            found.append(normalized)

    return found


def normalize_amenity_key(raw_key: str) -> str | None:
    """Maps an arbitrary amenity string to its canonical key if recognized."""
    cleaned = raw_key.strip().lower().replace("-", " ")
    if cleaned in AMENITY_CANONICAL_MAP:
        return AMENITY_CANONICAL_MAP[cleaned]

    # Try matching without spaces or with underscores
    slug = cleaned.replace(" ", "_")
    if slug in AMENITY_CANONICAL_MAP:
        return AMENITY_CANONICAL_MAP[slug]

    return None


def clean_and_build_draft(
    raw_draft: GeminiPropertyExtraction,
    raw_text: str = "",
    extra_overrides: dict[str, Any] | None = None,
) -> ExtractedPropertyDraft:
    """Clean, normalize, and construct an ExtractedPropertyDraft from Gemini's structured output.

    Handles:
    - Normalizing contact_phones and contact_phone with regex fallback against raw_text
    - Normalizing amenities dictionary and detecting maid room/toilet from amenity tags
    - Safe type coercion for all booleans, strings, and numeric values
    - Merging extra overrides (e.g. prospect metadata)
    """
    draft_dict = raw_draft.model_dump()

    # 1. Normalize phone numbers
    candidate_phones: list[str] = []
    if raw_draft.contact_phones:
        for p in raw_draft.contact_phones:
            cleaned = normalize_phone_number(str(p))
            if cleaned and cleaned not in candidate_phones:
                candidate_phones.append(cleaned)

    if raw_draft.contact_phone:
        cleaned_primary = normalize_phone_number(str(raw_draft.contact_phone))
        if cleaned_primary and cleaned_primary not in candidate_phones:
            candidate_phones.insert(0, cleaned_primary)

    # Fallback to regex on raw text if no phones found or to catch additional numbers
    if raw_text:
        text_phones = extract_phones_from_text(raw_text)
        for tp in text_phones:
            if tp not in candidate_phones:
                candidate_phones.append(tp)

    primary_phone = candidate_phones[0] if candidate_phones else None
    draft_dict["contact_phone"] = primary_phone
    draft_dict["contact_phones"] = candidate_phones

    # 2. Normalize amenities
    amenities_dict: dict[str, bool] = {}
    has_maids_room = bool(raw_draft.has_maids_room)
    has_maids_toilet = bool(raw_draft.has_maids_toilet)

    raw_amenities = raw_draft.amenities or []
    for amenity_item in raw_amenities:
        if not amenity_item:
            continue
        item_str = str(amenity_item).strip().lower()

        # Check for maid quarters inside amenity strings
        if any(mq in item_str for mq in ("maid room", "maid's room", "servant room", "servants room", "sewaka kamara")):
            has_maids_room = True
        if any(mt in item_str for mt in ("maid toilet", "maid's toilet", "servant toilet", "servants toilet", "sewaka wasikili")):
            has_maids_toilet = True

        canonical_key = normalize_amenity_key(item_str)
        if canonical_key:
            amenities_dict[canonical_key] = True

    # Also check raw text for common Sri Lankan terms if not yet recognized
    if raw_text:
        lower_text = raw_text.lower()
        if "තෙකලා විදුලිය" in raw_text or "tekala" in lower_text:
            amenities_dict["three_phase_electricity"] = True
        if "ළිං ජලය" in raw_text or "lin jalaya" in lower_text:
            amenities_dict["well_water"] = True
        if "තාප්ප" in raw_text or "wata thappa" in lower_text or "boundary wall" in lower_text:
            amenities_dict["boundary_wall"] = True
        if "නිරවුල් ඔප්පු" in raw_text or "සින්නක්කර" in raw_text or "sinnakkara" in lower_text:
            amenities_dict["clear_deeds"] = True
        if "සේවක කාමර" in raw_text or "sewaka kamara" in lower_text:
            has_maids_room = True
        if "සේවක වැසිකිළි" in raw_text or "sewaka wasikili" in lower_text:
            has_maids_toilet = True

    draft_dict["amenities"] = amenities_dict if amenities_dict else None
    draft_dict["has_maids_room"] = has_maids_room
    draft_dict["has_maids_toilet"] = has_maids_toilet
    draft_dict["is_gated_community"] = bool(raw_draft.is_gated_community)
    draft_dict["is_price_per_perch"] = bool(raw_draft.is_price_per_perch)

    # 3. Fallbacks for title and image_alt
    title = (draft_dict.get("title") or "").strip()
    location = (draft_dict.get("location") or "").strip() or "Colombo"
    prop_type = draft_dict.get("property_type") or PropertyType.HOUSE
    prop_type_str = prop_type.value if hasattr(prop_type, "value") else str(prop_type)

    if not title:
        listing_type_str = draft_dict.get("listing_type", ListingType.SALE)
        if hasattr(listing_type_str, "value"):
            listing_type_str = listing_type_str.value
        title = f"{prop_type_str.replace('_', ' ').title()} for {str(listing_type_str).title()} in {location}"
        draft_dict["title"] = title

    if not draft_dict.get("image_alt"):
        draft_dict["image_alt"] = f"{title} located in {location}"

    # 4. Merge extra overrides
    if extra_overrides:
        draft_dict.update(extra_overrides)

    return ExtractedPropertyDraft(**draft_dict)
