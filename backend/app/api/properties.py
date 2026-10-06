"""Property read endpoints."""

from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
import structlog

from app.agent.client import get_gemini_extractor_client
from app.config import get_settings
from app.auth import CurrentStaffUser, RootStaffUser
from app.db import queries
from app.db.session import get_db
from app.geocoding import Coordinates, GeocodingError, GoogleGeocoder
from app.models.property import ListingType, Property, PropertyStatus, PropertyType
from app.schemas.extractor import (
    ExtractedPropertyDraft,
    ExtractPropertyTextRequest,
    GeminiPropertyExtraction,
)
from app.schemas.property import PropertyCreate, PropertyRead, PropertyUpdate
from app.services.market_valuation import bulk_grade_properties, grade_property_pricing

logger = structlog.get_logger()

router = APIRouter(prefix="/properties", tags=["properties"])
admin_router = APIRouter(prefix="/admin/properties", tags=["admin-properties"])

DbSession = Annotated[Session, Depends(get_db)]


def _geocode_location(location: str) -> Coordinates:
    settings = get_settings()
    try:
        coordinates = GoogleGeocoder(settings.google_maps_api_key).geocode(location)
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Location geocoding is temporarily unavailable.",
        ) from exc
    if coordinates is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The property location could not be resolved.",
        )
    return coordinates


@router.post("/images", response_model=list[str])
def upload_property_images(
    files: Annotated[list[UploadFile], File()], _user: CurrentStaffUser
) -> list[str]:
    """Upload listing images to Cloudinary and return their secure URLs."""
    settings = get_settings()
    if not settings.cloudinary_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary is not configured on the backend.",
        )

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    urls: list[str] = []
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=415, detail="Only image files are allowed.")
        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder=settings.cloudinary_folder,
                resource_type="image",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Cloudinary could not store the image.",
            ) from exc
        secure_url = result.get("secure_url")
        if not secure_url:
            raise HTTPException(status_code=502, detail="Cloudinary returned no image URL.")
        urls.append(secure_url)
    return urls


def _attach_market_valuation(property_record: Property, grade_info: dict | None) -> PropertyRead:
    read_obj = PropertyRead.model_validate(property_record)
    if grade_info:
        read_obj.price_grade = grade_info.get("price_grade")
        read_obj.price_grade_label = grade_info.get("price_grade_label")
        read_obj.price_unit_rate = grade_info.get("price_unit_rate")
        read_obj.price_unit_label = grade_info.get("price_unit_label")
        read_obj.market_median_unit_rate = grade_info.get("market_median_unit_rate")
        read_obj.price_diff_percent = grade_info.get("price_diff_percent")
    return read_obj


@admin_router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyCreate, db: DbSession, _user: CurrentStaffUser) -> PropertyRead:
    property_data = payload.model_dump()
    coordinates = _geocode_location(property_data["location"])
    property_record = Property(
        **property_data,
        latitude=coordinates.latitude,
        longitude=coordinates.longitude,
    )
    db.add(property_record)
    db.commit()
    db.refresh(property_record)
    grade_info = grade_property_pricing(db, property_record)
    return _attach_market_valuation(property_record, grade_info)


@admin_router.post("/extract-from-text", response_model=ExtractedPropertyDraft)
def extract_property_from_text(
    payload: ExtractPropertyTextRequest,
    _user: CurrentStaffUser,
) -> ExtractedPropertyDraft:
    """Extract a structured property draft from unstructured text (e.g. WhatsApp, SMS, email).

    Supports English, Sinhala (සිංහල script), and Singlish. Converts Sri Lankan units
    (Laksha / Koti / Millions, per-perch pricing) and generates polished English listing text.
    """
    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasted text cannot be empty.",
        )

    prompt = f"""
    You are an expert real estate data extractor for Sri Lankan properties.
    Extract a structured real estate listing from the provided unstructured text.
    The input text may be written in English, Sinhala (සිංහල script), Singlish (Sinhala written in Latin script), or a blend.

    Unstructured Input:
    \"\"\"{raw_text}\"\"\"

    Instructions:
    1. Language & Output:
       - Regardless of whether the input is in Sinhala, Singlish, or English, generate the 'title' and 'description' in polished, professional English suitable for a Colombo-focused real estate catalog.
       - Title should be concise and descriptive (e.g. "Newly Built 3-Bedroom House in Homagama", "Luxury 2-Bedroom Apartment in Colombo 3").
       - Description should be well-written, informative English highlighting key property features, specifications, and neighborhood context, while omitting conversational/chat noise (e.g. "call quickly", "urgent sale", "genuine buyers only"). Never use terms like "lakhs" or "crores" in the description; standardize all price references to millions or thousands (e.g. "35M LKR", "2.5 Million LKR").
       - 'location' should be the standard Sri Lankan town or neighborhood name in English (e.g. "Homagama", "Colombo 4", "Rajagiriya", "Kaduwela", "Nugegoda", "Galle").

    2. Sri Lankan Currency & Price Conversion (CRITICAL):
       - Convert all prices into standard numerical LKR values.
       - "ලක්ෂ" / "Lakh" / "Laksha" / "Laks": 1 Lakh = 100,000 LKR.
         Examples:
         - "ලක්ෂ 280" / "280 Lakhs" -> 28000000.0 (28 Million)
         - "ලක්ෂ 85" / "85 Lakhs" -> 8500000.0 (8.5 Million)
         - "ලක්ෂ 12.5" -> 1250000.0
       - "කෝටි" / "Koti" / "Crore": 1 Koti = 10,000,000 LKR (10 Million).
         Examples:
         - "කෝටි 2" -> 20000000.0
         - "කෝටි 3.5" -> 35000000.0
       - "මිලියන" / "Million" / "M": 1 Million = 1,000,000 LKR.
         Example: "45 Million" / "45M" -> 45000000.0
       - Price per perch: If the price is stated per perch (e.g., "පර්චසය ලක්ෂ 15", "15 lakhs per perch", "1.5M pp"), set is_price_per_perch = True, and set price to the per-perch amount (e.g. 1500000.0). Otherwise set is_price_per_perch = False.
       - Rent: If the property is for rent / lease (e.g., "කුලියට", "rent", "monthly"), set listing_type = 'rent', and price to the monthly rent amount (e.g. 85000.0).

    3. Property & Listing Type:
       - property_type: 'house' ("නිවස", "ගෙයක්"), 'apartment' ("මහල් නිවාසය"), 'land' ("ඉඩම"), 'commercial' ("වෙළඳසැල", "ගොඩනැගිල්ල", "කාර්යාලය"), or 'mixed_use' ("නිවසක් සමඟ කර්මාන්ත ශාලාවක්", "house with factory/warehouse/workshop/commercial space").
       - listing_type: 'sale' ("විකිණීමට") or 'rent' ("කුලියට").

    4. Features & Specs:
       - bedrooms ("කාමර", "නිදන කාමර")
       - bathrooms ("නාන කාමර")
       - land_size_perches ("පර්චස්", "perches"). If stated in sqft, convert to perches (sqft / 272.25).
       - floor_area_sqft ("වර්ග අඩි", "sqft" of main house or primary building). Secondary buildings (like factory/warehouse) should be detailed in the description.
       - parking_spaces ("වාහන නැවැත්වීම", "parking", "garage spaces")
       - road_access_ft ("අඩි පාර", "road width in feet")
       - furnishing_status: 'unfurnished', 'semi_furnished', or 'fully_furnished' ("සම්පූර්ණ ගෘහ භාණ්ඩ සහිත")
       - has_maids_room: True if maid's/servant's room or quarters is mentioned ("සේවක කාමරය")
       - has_maids_toilet: True if maid's/servant's toilet or bathroom is mentioned ("සේවක වැසිකිළිය")
       - is_gated_community: True if gated community or secured housing scheme

    5. Amenities & Key Facilities:
       - Extract features into a list of lowercase keys including:
         - "ac", "pool", "gym", "generator", "security", "garden", "hot_water"
         - "three_phase_electricity" ("තෙකලා විදුලිය")
         - "well_water" ("ළිං ජලය")
         - "boundary_wall" ("තාප්ප" / "වට තාප්ප")
         - "clear_deeds" ("නිරවුල් ඔප්පු" / "සින්නක්කර")
         - "cctv"
         - "wifi"

    6. Contact Information:
       - If a contact name or phone number is mentioned in the text:
         - contact_name (e.g. "Ranjith", "Mrs. Silva")
         - contact_phone (primary number e.g. "0771234567")
         - contact_phones (list of all phone numbers mentioned)
         - contact_type: "owner" if owner ("අයිතිකරු"), "broker" if broker ("බ්‍රෝකර්", "නියෝජිත"), or None.

    7. image_alt:
       - A short descriptive alt text in English for the primary listing photo (e.g. "Modern two-story house with factory in Ja-Ela").
    """

    extractor = get_gemini_extractor_client()
    try:
        raw_draft = extractor.generate_structured(prompt=prompt, schema=GeminiPropertyExtraction)

        amenities_dict = None
        if raw_draft.amenities:
            amenities_dict = {a: True for a in raw_draft.amenities}

        draft_dict = raw_draft.model_dump()
        draft_dict["amenities"] = amenities_dict
        if not draft_dict.get("contact_phones") and draft_dict.get("contact_phone"):
            draft_dict["contact_phones"] = [draft_dict["contact_phone"]]

        return ExtractedPropertyDraft(**draft_dict)
    except Exception as exc:
        logger.exception("admin_property_extract_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Property extraction failed: {str(exc)}",
        ) from exc


# Keep this above any future "/{property_id}" route, or "featured" gets parsed as a
# UUID and 422s.
@router.get("/featured", response_model=list[PropertyRead])
def get_featured_properties(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=queries.MAX_FEATURED_LIMIT)] = (
        queries.DEFAULT_FEATURED_LIMIT
    ),
) -> Sequence[Property]:
    """Curated set for the homepage grid. Empty table returns [], not a 404."""
    return queries.featured_properties(db, limit=limit)


@admin_router.get("", response_model=list[PropertyRead])
def get_admin_properties(
    db: DbSession,
    _user: CurrentStaffUser,
    search: Annotated[str | None, Query(max_length=120)] = None,
    property_status: Annotated[PropertyStatus | None, Query(alias="status")] = None,
    property_type: PropertyType | None = None,
    listing_type: ListingType | None = None,
    is_featured: bool | None = None,
    price_grade: str | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[PropertyRead]:
    records = queries.admin_properties(
        db,
        search=search,
        status=property_status,
        property_type=property_type,
        listing_type=listing_type,
        is_featured=is_featured,
        offset=offset,
        limit=limit,
    )
    grades_map = bulk_grade_properties(db, records)
    reads = [_attach_market_valuation(p, grades_map.get(p.id)) for p in records]
    if price_grade and price_grade != "all":
        reads = [r for r in reads if r.price_grade == price_grade]
    return reads


@admin_router.get("/{property_id}", response_model=PropertyRead)
def get_admin_property(property_id: UUID, db: DbSession, _user: CurrentStaffUser) -> PropertyRead:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    grade_info = grade_property_pricing(db, property_record)
    return _attach_market_valuation(property_record, grade_info)


@admin_router.patch("/{property_id}", response_model=PropertyRead)
def update_admin_property(
    property_id: UUID, payload: PropertyUpdate, db: DbSession, _user: CurrentStaffUser
) -> PropertyRead:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")

    changes = payload.model_dump(exclude_unset=True)
    if "location" in changes and (
        changes["location"] != property_record.location
        or property_record.latitude is None
        or property_record.longitude is None
    ):
        coordinates = _geocode_location(changes["location"])
        changes["latitude"] = coordinates.latitude
        changes["longitude"] = coordinates.longitude

    for field, value in changes.items():
        setattr(property_record, field, value)
    db.commit()
    db.refresh(property_record)
    grade_info = grade_property_pricing(db, property_record)
    return _attach_market_valuation(property_record, grade_info)


@admin_router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_property(property_id: UUID, db: DbSession, _user: RootStaffUser) -> None:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    db.delete(property_record)
    db.commit()
