"""Service for fetching contact details and enriching prospects from portal detail pages."""

from typing import Any
import structlog
from sqlalchemy.orm import Session

from app.models.prospect import Prospect
from app.scraper.classifier import classify_lpw_listing_heuristics
from app.scraper.ikman_client import IkmanClient
from app.scraper.lpw_client import LankaPropertyWebClient
from app.scraper.schemas import LpwAd
from app.services.geocoding import geocode_location

logger = structlog.get_logger(__name__)


def _enrich_location_from_detail(db: Session, prospect: Prospect, detail: Any) -> bool:
    """Enriches prospect suburb, location and geocodes from Ikman ad detail payload."""
    changed = False
    if not detail or not detail.location:
        return False

    loc_obj = detail.location
    suburb_name = None
    parent_district = None

    if isinstance(loc_obj, dict):
        suburb_name = loc_obj.get("name")
        parent = loc_obj.get("parent")
        if isinstance(parent, dict):
            parent_district = parent.get("name")
    elif hasattr(loc_obj, "name"):
        suburb_name = loc_obj.name
        if hasattr(loc_obj, "parent") and loc_obj.parent:
            parent_district = (
                loc_obj.parent.get("name")
                if isinstance(loc_obj.parent, dict)
                else getattr(loc_obj.parent, "name", None)
            )

    if suburb_name:
        if prospect.suburb != suburb_name or prospect.suburb_source != "ikman_detail":
            prospect.suburb = suburb_name
            prospect.suburb_source = "ikman_detail"
            changed = True

        if parent_district and prospect.location != parent_district:
            prospect.location = parent_district
            changed = True

        # Re-geocode with verified suburb
        target = f"{suburb_name}, {prospect.location}" if prospect.location else suburb_name
        lat, lng = geocode_location(db, target)
        if lat is not None and (prospect.latitude != lat or prospect.longitude != lng):
            prospect.latitude = lat
            prospect.longitude = lng
            changed = True

    return changed


async def fetch_prospect_contact_details(
    prospect: Prospect,
    db: Session,
    *,
    force: bool = False,
) -> bool:
    """Auto-fetch contact details (poster name, phone number, location, etc.) for a prospect.

    Returns True if contact details or ad metadata were updated, False otherwise.
    """
    if not force and prospect.phone_number:
        return False

    is_lpw = prospect.source == "lpw" or bool(
        prospect.source_url and "lankapropertyweb" in prospect.source_url
    )

    if is_lpw:
        target_url = prospect.source_url or prospect.ikman_url
        if not target_url:
            return False

        client = LankaPropertyWebClient(delay=0)
        try:
            detail = await client.fetch_ad_detail(target_url)
            if not detail:
                return False

            updated = False
            if detail.phone_number and prospect.phone_number != detail.phone_number:
                prospect.phone_number = detail.phone_number
                updated = True
            if detail.poster_name and prospect.poster_name != detail.poster_name:
                prospect.poster_name = detail.poster_name
                updated = True
            if detail.agent_type:
                dummy_ad = LpwAd(
                    id=prospect.source_id or str(prospect.id),
                    title=prospect.title,
                    url=target_url,
                )
                c_cls, c_conf, c_reas = classify_lpw_listing_heuristics(dummy_ad, detail=detail)
                if (
                    prospect.classification != c_cls
                    or prospect.confidence != c_conf
                    or prospect.classification_reasons != c_reas
                ):
                    prospect.classification = c_cls
                    prospect.confidence = c_conf
                    prospect.classification_reasons = c_reas
                    updated = True

            if updated:
                db.commit()
                db.refresh(prospect)
                return True
            return False
        except Exception as exc:
            logger.warning(
                "fetch_prospect_contact_error.lpw",
                prospect_id=str(prospect.id),
                url=target_url,
                error=str(exc),
            )
            return False
        finally:
            await client.close()
    else:
        slug = prospect.ikman_slug
        if not slug and (prospect.source_url or prospect.ikman_url):
            raw_url = prospect.source_url or prospect.ikman_url or ""
            slug = raw_url.rstrip("/").split("/")[-1]
            if slug:
                prospect.ikman_slug = slug

        if not slug:
            return False

        client = IkmanClient(delay=0)
        try:
            detail = await client.fetch_ad_detail(slug)
            if not detail:
                return False

            loc_updated = _enrich_location_from_detail(db, prospect, detail)
            contact_updated = False
            if detail.contactCard:
                if detail.contactCard.name and prospect.poster_name != detail.contactCard.name:
                    prospect.poster_name = detail.contactCard.name
                    contact_updated = True
                if detail.contactCard.phoneNumbers:
                    new_phone = str(detail.contactCard.phoneNumbers[0].get("number", ""))
                    if new_phone and prospect.phone_number != new_phone:
                        prospect.phone_number = new_phone
                        contact_updated = True

            if contact_updated or loc_updated:
                db.commit()
                db.refresh(prospect)
                return True
            return False
        except Exception as exc:
            logger.warning(
                "fetch_prospect_contact_error.ikman",
                prospect_id=str(prospect.id),
                slug=slug,
                error=str(exc),
            )
            return False
        finally:
            await client.close()
