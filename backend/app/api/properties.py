"""Property read endpoints."""

import asyncio
from collections.abc import Sequence
import io
import re
from typing import Annotated
import urllib.parse
from uuid import UUID
import zipfile

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session
import structlog

from app.agent.client import get_gemini_extractor_client
from app.config import get_settings
from app.auth import CurrentStaffUser, RootStaffUser
from app.db import queries
from app.db.session import get_db
from app.geocoding import Coordinates, GeocodingError, GoogleGeocoder
from app.models.auth import StaffUser
from app.models.property import ListingType, Property, PropertyStatus, PropertyType
from app.models.property_contact import PropertyContact, PropertyContactType
from app.models.prospect import Prospect
from app.schemas.auth import StaffRole
from app.schemas.extractor import (
    ExtractedPropertyDraft,
    ExtractPropertyTextRequest,
    GeminiPropertyExtraction,
)
from app.schemas.property import InventorySummary, PropertyCreate, PropertyRead, PropertyUpdate
from app.services.extraction_cleaner import clean_and_build_draft
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


def _redact_owner_details(
    read_obj: PropertyRead,
    property_record: Property,
    user: StaffUser,
) -> PropertyRead:
    if user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        contact = property_record.property_contact
        is_owner = (
            (contact and contact.contact_type in (PropertyContactType.OWNER, "owner"))
            or (
                read_obj.property_contact
                and read_obj.property_contact.contact_type in (PropertyContactType.OWNER, "owner")
            )
        )
        if is_owner:
            read_obj.property_contact = None
            read_obj.property_contact_id = None
    return read_obj


@admin_router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyCreate, db: DbSession, _user: CurrentStaffUser) -> PropertyRead:
    if _user.role not in (StaffRole.ROOT, StaffRole.ADMIN) and payload.property_contact_id:
        contact = db.get(PropertyContact, payload.property_contact_id)
        if contact and contact.contact_type in (PropertyContactType.OWNER, "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Agents are not permitted to assign property owner details.",
            )
    property_data = payload.model_dump()
    if not property_data.get("property_code"):
        property_data["property_code"] = queries.generate_next_property_code(db)
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
    read_obj = _attach_market_valuation(property_record, grade_info)
    return _redact_owner_details(read_obj, property_record, _user)


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
       - Title should be concise and descriptive (e.g. "Prime Commercial Building on Galle Road, Dehiwala", "Newly Built 3-Bedroom House in Homagama", "Luxury 2-Bedroom Apartment in Colombo 3").
       - Description should be well-written, informative English highlighting key property features, specifications, and neighborhood context, while omitting conversational/chat noise (e.g. "call quickly", "urgent sale", "genuine buyers only"). Never use terms like "lakhs" or "crores" in the description; standardize all price references to millions or thousands (e.g. "35M LKR", "2.5 Million LKR", "160 Million LKR").
       - 'location': Extract the primary Sri Lankan town, city, or Colombo suburb in English (e.g. "Dehiwala", "Homagama", "Colombo 3", "Kollupitiya", "Rajagiriya", "Kaduwela", "Nugegoda", "Battaramulla", "Malabe", "Galle").
         If an arterial road or landmark is mentioned (e.g. "Galle Road, Dehiwala", "High Level Road, Pannipitiya"), extract the suburb ("Dehiwala", "Pannipitiya") as 'location', and include the street context in the title/description.

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
         - "කෝටි 16" -> 160000000.0
         - "කෝටි 3.5" -> 350000000.0
       - "මිලියන" / "Million" / "M" / "Mn": 1 Million = 1,000,000 LKR.
         Examples: "45 Million" / "45M" -> 45000000.0, "160 Million" / "160M" -> 160000000.0
       - Price per perch: If the price is stated per perch (e.g., "පර්චසය ලක්ෂ 15", "15 lakhs per perch", "1.5M pp", "15 laks per perch"), set is_price_per_perch = True, and set price to the per-perch amount (e.g. 1500000.0).
         If total price is given, set is_price_per_perch = False, and set price to total amount.
       - Rent: If the property is for rent / lease (e.g., "කුලියට", "rent", "monthly", "badhata"), set listing_type = 'rent', and price to monthly rent (e.g. 85000.0).
       - If price is omitted or purely "call for price", set price = None. If negotiable price is given (e.g. "160M negotiable" / "ලක්ෂ 1600යි සාකච්ඡා කල හැක"), extract the numeric price.

    3. Property & Listing Type:
       - property_type:
         - 'mixed_use': Combined commercial and residential, building with factory/workshop, or house with shop ("Commercial and Residential", "නිවසක් සමඟ කර්මාන්ත ශාලාවක්/වෙළඳසැලක්").
         - 'commercial': Pure commercial buildings, showrooms, office spaces, warehouses ("වෙළඳසැල", "ගොඩනැගිල්ල", "කාර්යාලය").
         - 'apartment': Apartments, flats, condominium units ("මහල් නිවාසය").
         - 'house': Independent houses, villas, single/multi-story homes ("නිවස", "ගෙයක්").
         - 'land': Bare land, estate plots, commercial blocks ("ඉඩම").
       - listing_type: 'sale' ("විකිණීමට", "wikineemata") or 'rent' ("කුලියට", "kuliyata").

    4. Features & Specs:
       - bedrooms ("කාමර", "නිදන කාමර", "rooms", "beds")
       - bathrooms ("නාන කාමර", "baths")
       - land_size_perches ("පර්චස්", "perches", "P"). If given in acres ("අක්කර"), 1 acre = 160 perches. If given in sqft, convert (sqft / 272.25).
       - floor_area_sqft ("වර්ග අඩි", "sqft", "sq.ft" of main house or primary building). Secondary buildings should be detailed in the description.
       - parking_spaces ("වාහන නැවැත්වීම", "parking", "garage spaces", "parking for X vehicles")
       - road_access_ft ("අඩි පාර", "road width in feet", "ft road access")
       - furnishing_status: 'unfurnished', 'semi_furnished', or 'fully_furnished' ("සම්පූර්ණ ගෘහ භාණ්ඩ සහිත")
       - has_maids_room: True if maid's/servant's room or quarters is mentioned ("සේවක කාමරය", "sewaka kamara")
       - has_maids_toilet: True if maid's/servant's toilet or bathroom is mentioned ("සේවක වැසිකිළිය", "sewaka wasikili")
       - is_gated_community: True if gated community or secured housing scheme

    5. Amenities & Key Facilities:
       - Extract features into a list of lowercase keys including:
         - "ac", "pool", "gym", "generator", "security", "garden", "hot_water"
         - "three_phase_electricity" ("තෙකලා විදුලිය", "3 phase")
         - "well_water" ("ළිං ජලය")
         - "boundary_wall" ("තාප්ප", "වට තාප්ප")
         - "clear_deeds" ("නිරවුල් ඔප්පු", "සින්නක්කර", "බිම් සවිය")
         - "cctv"
         - "wifi"

    6. Contact Information:
       - Extract any contact details mentioned:
         - contact_name (e.g. "Ranjith", "Mrs. Silva")
         - contact_phone (primary number e.g. "0771234567")
         - contact_phones (list of all phone numbers mentioned e.g. ["0771234567", "0719876543"])
         - contact_type: "owner" if owner ("අයිතිකරු"), "broker" if broker ("බ්‍රෝකර්", "නියෝජිත"), or None.

    7. image_alt:
       - A short descriptive alt text in English for the primary listing photo (e.g. "Commercial and residential building on Galle Road, Dehiwala").
    """

    extractor = get_gemini_extractor_client()
    try:
        raw_draft = extractor.generate_structured(prompt=prompt, schema=GeminiPropertyExtraction)
        draft = clean_and_build_draft(raw_draft, raw_text=raw_text)
        if _user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
            if draft.contact_type in (None, "owner"):
                draft.contact_name = None
                draft.contact_phone = None
                draft.contact_phones = []
                draft.contact_type = None
        return draft
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


@router.get("/inventory-summary", response_model=InventorySummary)
def get_inventory_summary(db: DbSession) -> InventorySummary:
    """Public aggregate counts of available properties and active market prospects."""
    verified_count = db.scalar(
        select(func.count()).select_from(Property).where(Property.status == PropertyStatus.AVAILABLE)
    ) or 0
    prospects_count = db.scalar(
        select(func.count()).select_from(Prospect).where(Prospect.status != "discarded")
    ) or 0
    return InventorySummary(
        total_listings=verified_count + prospects_count,
        verified_properties=verified_count,
        tracked_prospects=prospects_count,
    )


@router.get("/{property_id}", response_model=PropertyRead)
def get_public_property(property_id: str, db: DbSession) -> PropertyRead:
    """Public read endpoint for a single property by ID or property code."""
    property_record = queries.available_property_by_id_or_code(db, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    grade_info = grade_property_pricing(db, property_record)
    return _attach_market_valuation(property_record, grade_info)


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
    reads = [
        _redact_owner_details(_attach_market_valuation(p, grades_map.get(p.id)), p, _user)
        for p in records
    ]
    if price_grade and price_grade != "all":
        reads = [r for r in reads if r.price_grade == price_grade]
    return reads


@admin_router.get("/download-image")
async def download_single_image(
    url: Annotated[str, Query(description="Absolute URL of the image to download")],
    _user: CurrentStaffUser,
    filename: Annotated[str | None, Query(description="Optional custom file name for download")] = None,
) -> Response:
    """Proxy and force download of a property photo. Restricted to Root and Admin staff."""
    if _user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Root access required to download property photos.",
        )

    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only HTTP and HTTPS URLs are permitted.",
        )

    parsed = urllib.parse.urlparse(clean_url)
    hostname = (parsed.hostname or "").lower()
    if (
        hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1")
        or hostname.startswith("192.168.")
        or hostname.startswith("10.")
        or hostname.startswith("172.16.")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disallowed target host.",
        )

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(clean_url)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Upstream server returned {resp.status_code}.",
                )
            content_type = resp.headers.get("content-type", "image/jpeg")
            data = resp.content
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("single_photo_download_failed", url=clean_url, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve image from upstream server.",
        ) from exc

    ext = ".jpg"
    if "png" in content_type:
        ext = ".png"
    elif "webp" in content_type:
        ext = ".webp"

    base_name = re.sub(r"[^\w\-.]+", "_", filename.strip() if filename else "property-photo")
    if not any(base_name.lower().endswith(e) for e in (".jpg", ".jpeg", ".png", ".webp")):
        base_name = f"{base_name}{ext}"

    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{base_name}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@admin_router.get("/{property_id}/photos/zip")
async def download_property_photos_zip(
    property_id: str,
    db: DbSession,
    _user: CurrentStaffUser,
) -> StreamingResponse:
    """Download all photos for a property bundled into a single ZIP archive. Restricted to Root and Admin staff."""
    if _user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Root access required to download property photos.",
        )

    ident_str = str(property_id).strip()
    stmt = select(Property)
    try:
        val_uuid = UUID(ident_str)
        stmt = stmt.where(Property.id == val_uuid)
    except ValueError:
        stmt = stmt.where(func.upper(Property.property_code) == ident_str.upper())
    property_record = db.execute(stmt).scalar_one_or_none()

    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")

    urls: list[str] = []
    if property_record.featured_image_url and property_record.featured_image_url.strip():
        urls.append(property_record.featured_image_url.strip())
    for u in property_record.image_urls or []:
        if u and u.strip() and u.strip() not in urls:
            urls.append(u.strip())

    if not urls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No photos available for this property.",
        )

    code = property_record.property_code or str(property_record.id)[:8]
    slug = re.sub(r"[^\w\-]+", "-", f"{code}-{property_record.title}").strip("-")[:50] or "property"
    zip_filename = f"{slug}-photos.zip"

    async def _fetch(client: httpx.AsyncClient, u: str) -> tuple[str, bytes | None, str | None]:
        if not u.startswith(("http://", "https://")):
            return u, None, None
        try:
            r = await client.get(u)
            if r.status_code == 200:
                return u, r.content, r.headers.get("content-type")
        except Exception as exc:
            logger.warning("zip_photo_fetch_failed", url=u, error=str(exc))
        return u, None, None

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        results = await asyncio.gather(*[_fetch(client, u) for u in urls])

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        saved_count = 0
        for idx, (orig_url, data, ctype) in enumerate(results, start=1):
            if not data:
                continue
            ext = ".jpg"
            if ctype:
                if "png" in ctype:
                    ext = ".png"
                elif "webp" in ctype:
                    ext = ".webp"
                elif "jpeg" in ctype or "jpg" in ctype:
                    ext = ".jpg"
            else:
                path_part = orig_url.split("?")[0].lower()
                for ce in (".png", ".webp", ".jpeg", ".jpg"):
                    if path_part.endswith(ce):
                        ext = ce if ce != ".jpeg" else ".jpg"
                        break
            photo_filename = f"{slug}-{idx:02d}{ext}"
            zf.writestr(photo_filename, data)
            saved_count += 1

    if saved_count == 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve photos from remote host.",
        )

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "Cache-Control": "no-cache",
        },
    )


@admin_router.get("/{property_id}", response_model=PropertyRead)
def get_admin_property(property_id: UUID, db: DbSession, _user: CurrentStaffUser) -> PropertyRead:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    grade_info = grade_property_pricing(db, property_record)
    read_obj = _attach_market_valuation(property_record, grade_info)
    return _redact_owner_details(read_obj, property_record, _user)


@admin_router.patch("/{property_id}", response_model=PropertyRead)
def update_admin_property(
    property_id: UUID, payload: PropertyUpdate, db: DbSession, _user: CurrentStaffUser
) -> PropertyRead:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")

    changes = payload.model_dump(exclude_unset=True)
    if _user.role not in (StaffRole.ROOT, StaffRole.ADMIN):
        has_owner_contact = bool(
            property_record.property_contact
            and property_record.property_contact.contact_type in (PropertyContactType.OWNER, "owner")
        )
        if "property_contact_id" in changes:
            new_contact_id = changes["property_contact_id"]
            if new_contact_id is not None:
                new_contact = db.get(PropertyContact, new_contact_id)
                if new_contact and new_contact.contact_type in (PropertyContactType.OWNER, "owner"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Agents are not permitted to edit or assign property owner details.",
                    )
                if has_owner_contact and new_contact_id != property_record.property_contact_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Agents are not permitted to edit property owner details.",
                    )
            elif has_owner_contact:
                # Agent submitted update where property_contact_id was unset/None in form because owner was hidden.
                # Preserve the existing owner contact.
                changes.pop("property_contact_id")

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
    read_obj = _attach_market_valuation(property_record, grade_info)
    return _redact_owner_details(read_obj, property_record, _user)


@admin_router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_property(property_id: UUID, db: DbSession, _user: RootStaffUser) -> None:
    property_record = db.get(Property, property_id)
    if property_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")
    db.delete(property_record)
    db.commit()
