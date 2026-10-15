import asyncio
import re
import socket
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import httpx
import structlog

from app.scraper.schemas import LpwAd, LpwAdDetail

logger = structlog.get_logger(__name__)

LPW_BASE_URL = "https://www.lankapropertyweb.com"

# Ensure IPv4 resolution for lankapropertyweb.com to prevent Cloudflare IPv6 connection timeouts
_orig_getaddrinfo = socket.getaddrinfo


def _lpw_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host and "lankapropertyweb.com" in str(host):
        return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


socket.getaddrinfo = _lpw_getaddrinfo


class LankaPropertyWebClient:
    def __init__(self, delay: float = 1.0):
        self.client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        self.delay = delay

    async def close(self):
        await self.client.aclose()

    def _normalize_category(self, category: str) -> str:
        cat_lower = category.lower().strip()
        if "apart" in cat_lower:
            return "Apartment"
        if "land" in cat_lower:
            return "Land"
        if "commercial" in cat_lower:
            return "Commercial"
        if "bungalow" in cat_lower:
            return "Bungalow"
        if "villa" in cat_lower:
            return "Villa"
        return "House"

    def _parse_listing_item(
        self,
        item: Any,
        default_property_type: str = "house",
        default_listing_type: str = "sale",
    ) -> LpwAd | None:
        try:
            # 1. Ad ID and Link
            link_tag = item.find("a", href=re.compile(r"property_details-\d+\.html"))
            href = link_tag["href"] if link_tag and link_tag.get("href") else None
            ad_id = item.get("data-ad-id")
            if not ad_id and href:
                match = re.search(r"property_details-(\d+)\.html", href)
                if match:
                    ad_id = match.group(1)

            if not ad_id:
                return None

            full_url = urljoin(LPW_BASE_URL, href) if href else f"{LPW_BASE_URL}/sale/property_details-{ad_id}.html"

            # 2. Title
            title_tag = item.find(class_=re.compile(r"listing-title"))
            title = title_tag.get_text(strip=True) if title_tag else "Untitled Listing"

            # 3. Price
            price_tag = item.find(class_=re.compile(r"listing-price"))
            price = price_tag.get_text(separator=" ", strip=True) if price_tag else None

            # 4. Location & Address
            loc_tag = item.find(class_=re.compile(r"^location$|listing-location"))
            suburb = loc_tag.get_text(strip=True) if loc_tag else None

            addr_tag = item.find(class_=re.compile(r"listing-address"))
            address_text = addr_tag.get_text(strip=True) if addr_tag else ""
            location_str = address_text or suburb or ""

            # 5. Features (Bedrooms, Floor Area, Property Type)
            bedrooms = None
            floor_area_sqft = None
            prop_type = default_property_type

            summary_box = item.find(class_=re.compile(r"listing-summery|listing-summary"))
            if summary_box:
                # Count tags
                counts = summary_box.find_all(class_="count")
                if len(counts) >= 1:
                    try:
                        bedrooms = int(counts[0].get_text(strip=True))
                    except (ValueError, TypeError):
                        pass
                if len(counts) >= 2:
                    try:
                        raw_area = counts[1].get_text(strip=True).replace(",", "")
                        floor_area_sqft = float(raw_area)
                    except (ValueError, TypeError):
                        pass

                type_tag = summary_box.find(class_="type")
                if type_tag and type_tag.get_text(strip=True):
                    prop_type = type_tag.get_text(strip=True).lower()

            # 6. Description snippet
            desc_tag = item.find(class_=re.compile(r"listing-description"))
            desc_snippet = desc_tag.get_text(strip=True) if desc_tag else None
            if desc_snippet and desc_snippet.endswith("more »"):
                desc_snippet = desc_snippet[:-6].strip()

            # 7. Agent signals on search card (verified badge, agency logo, etc.)
            has_agent_logo = False
            agent_logo = item.find(class_=re.compile(r"agent-logo"))
            if agent_logo and agent_logo.find("img"):
                has_agent_logo = True
            elif item.find(class_=re.compile(r"verified_agent")):
                has_agent_logo = True
            else:
                footer = item.find(class_=re.compile(r"listing-footer"))
                if footer and "verified agent" in footer.get_text().lower():
                    has_agent_logo = True

            return LpwAd(
                id=str(ad_id),
                title=title,
                url=full_url,
                price=price,
                location=location_str,
                suburb=suburb,
                property_type=prop_type,
                listing_type=default_listing_type,
                bedrooms=bedrooms,
                floor_area_sqft=floor_area_sqft,
                has_agent_logo=has_agent_logo,
                description_snippet=desc_snippet,
            )
        except Exception as e:
            logger.warning("lpw_listing_item_parse_failed", error=str(e))
            return None

    async def fetch_listing_page(
        self,
        category: str = "House",
        page: int = 1,
        query: str | None = None,
        listing_type: str = "sale",
    ) -> tuple[list[LpwAd], bool]:
        """
        Fetches a page of listings from LankaPropertyWeb.
        Returns: (ads, has_more)
        """
        norm_cat = self._normalize_category(category)
        is_rent = "rent" in listing_type.lower()
        base_endpoint = f"{LPW_BASE_URL}/rentals/index.php" if is_rent else f"{LPW_BASE_URL}/sale/index.php"

        params: dict[str, Any] = {
            "page": page,
            "property-type": norm_cat,
        }
        if query and query.strip():
            params["searchbox"] = query.strip()

        logger.info(
            "fetching_lpw_listing_page",
            endpoint=base_endpoint,
            page=page,
            category=norm_cat,
            query=query,
            listing_type="rent" if is_rent else "sale",
        )

        try:
            response = await self.client.get(base_endpoint, params=params)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            items = soup.find_all(class_="listing-item")

            ads: list[LpwAd] = []
            prop_type_str = norm_cat.lower()
            listing_type_str = "rent" if is_rent else "sale"

            for item in items:
                ad = self._parse_listing_item(
                    item,
                    default_property_type=prop_type_str,
                    default_listing_type=listing_type_str,
                )
                if ad:
                    ads.append(ad)

            # When items count is 0, we reached the end of available pages
            has_more = len(items) > 0 and len(ads) > 0

            await asyncio.sleep(self.delay)
            return ads, has_more

        except httpx.HTTPError as e:
            logger.error("http_error_fetching_lpw_listings", error=str(e), url=base_endpoint)
            return [], False

    async def fetch_ad_detail(self, detail_url: str) -> LpwAdDetail | None:
        """
        Fetches full details for a LankaPropertyWeb listing including
        phone number, seller name, explicit agent type, specs, and images.
        """
        full_url = detail_url if detail_url.startswith("http") else urljoin(LPW_BASE_URL, detail_url)
        logger.info("fetching_lpw_ad_detail", url=full_url)

        try:
            response = await self.client.get(full_url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract ad id from URL
            ad_id = ""
            id_match = re.search(r"property_details-(\d+)\.html", full_url)
            if id_match:
                ad_id = id_match.group(1)

            # Title
            title_tag = soup.find("h1") or soup.find(class_=re.compile(r"property-title|title"))
            title = title_tag.get_text(strip=True) if title_tag else (soup.title.string.strip() if soup.title else "")

            # Price
            price_tag = soup.find(class_=re.compile(r"price|listing-price"))
            price = price_tag.get_text(separator=" ", strip=True) if price_tag else None

            # Explicit Agent Type ("Owner", "Agent", "Developer")
            agent_type = None
            agent_label_tag = soup.find(class_=re.compile(r"agent-type-label|advertiser-type"))
            if agent_label_tag:
                raw_type = agent_label_tag.get_text(strip=True)
                if raw_type:
                    agent_type = raw_type

            # Check agent-head for type if not yet found
            agent_head = soup.find(class_=re.compile(r"agent-head"))
            if not agent_type and agent_head:
                head_name = agent_head.find(class_=re.compile(r"agent-name"))
                if head_name:
                    head_text = head_name.get_text(strip=True)
                    if head_text.lower() in ("owner", "agent", "developer"):
                        agent_type = head_text.capitalize()

            # Check presence of private seller section container
            if not agent_type and soup.find(class_=re.compile(r"pvt-seller")):
                agent_type = "Owner"

            # Poster Name & Phone Number
            poster_name = None
            phone_number = None

            # 1. Structured contact rows in .agent-contacts
            agent_contacts = soup.find(class_=re.compile(r"agent-contacts"))
            if agent_contacts:
                contact_rows = agent_contacts.find_all(class_=re.compile(r"agent-row"))
                for row in contact_rows:
                    # Skip the table header (which contains 'Agent' / 'Owner' / 'Developer' as column titles)
                    row_classes = row.get("class", [])
                    if any("agent-head" in c for c in row_classes):
                        continue

                    # Extract person / agency name
                    name_el = row.find(class_=re.compile(r"agent-name"))
                    if name_el and not poster_name:
                        candidate_name = name_el.get_text(strip=True)
                        if candidate_name and candidate_name.lower() not in (
                            "owner",
                            "agent",
                            "developer",
                            "number",
                            "name",
                        ):
                            poster_name = candidate_name

                    # Extract phone number
                    if not phone_number:
                        tel_tag = row.find("a", href=re.compile(r"^tel:"))
                        if tel_tag and tel_tag.get("href"):
                            phone_number = tel_tag["href"].replace("tel:", "").strip()
                        else:
                            num_el = row.find(class_=re.compile(r"agent-number|contact-number"))
                            if num_el:
                                phone_match = re.search(r"(\+?\d[\d\s-]{7,15})", num_el.get_text())
                                if phone_match:
                                    phone_number = phone_match.group(1).strip()

                    if poster_name and phone_number:
                        break

            # 2. Fallback poster name from private seller section title
            if not poster_name:
                pvt_seller = soup.find(class_=re.compile(r"bottom-sec-pvt-seller"))
                if pvt_seller:
                    title_div = pvt_seller.find(class_=re.compile(r"^title$|\btitle\b"))
                    if title_div:
                        temp_soup = BeautifulSoup(str(title_div), "html.parser")
                        for sub in temp_soup.find_all(class_=re.compile(r"agent-type-label")):
                            sub.decompose()
                        candidate = temp_soup.get_text(strip=True)
                        if candidate and candidate.lower() not in ("owner", "agent", "developer", "contact"):
                            poster_name = candidate

            # 3. Fallback poster name from phone-info or advertiser-name
            if not poster_name:
                seller_tag = soup.find(class_=re.compile(r"phone-info|advertiser-name"))
                if seller_tag:
                    text = seller_tag.get_text(strip=True)
                    if ":" in text:
                        candidate = text.split(":")[0].strip()
                        if candidate.lower() not in ("owner", "agent", "developer"):
                            poster_name = candidate
                    elif text and len(text) < 50 and text.lower() not in ("owner", "agent", "developer"):
                        poster_name = text

            # 4. Fallback phone number
            if not phone_number:
                tel_link = soup.find("a", href=re.compile(r"^tel:"))
                if tel_link and tel_link.get("href"):
                    phone_number = tel_link["href"].replace("tel:", "").strip()
                else:
                    phone_elem = soup.find(class_=re.compile(r"phone-info|contact-number"))
                    if phone_elem:
                        phone_match = re.search(r"(\+?\d[\d\s-]{7,15})", phone_elem.get_text())
                        if phone_match:
                            phone_number = phone_match.group(1).strip()

            # Guard against saving placeholder names
            if poster_name and poster_name.strip().lower() in ("owner", "agent", "developer", "none", "null"):
                poster_name = None

            # Specifications from Overview Table
            bathrooms = None
            bedrooms = None
            land_extent_perches = None
            floor_area_sqft = None
            furnishing_status = None

            overview_items = soup.find_all(class_=re.compile(r"overview-item"))
            for item in overview_items:
                text = item.get_text(separator=" | ", strip=True)
                parts = [p.strip() for p in text.split("|") if p.strip()]
                if len(parts) >= 2:
                    label, val = parts[0].lower(), parts[1]
                    if "bedroom" in label:
                        try:
                            bedrooms = int(re.search(r"\d+", val).group(0))
                        except Exception:
                            pass
                    elif "bathroom" in label:
                        try:
                            bathrooms = int(re.search(r"\d+", val).group(0))
                        except Exception:
                            pass
                    elif "floor area" in label:
                        try:
                            floor_area_sqft = float(re.search(r"[\d.]+", val.replace(",", "")).group(0))
                        except Exception:
                            pass
                    elif "land" in label and "perch" in val.lower():
                        try:
                            land_extent_perches = float(re.search(r"[\d.]+", val.replace(",", "")).group(0))
                        except Exception:
                            pass
                    elif "furnish" in label:
                        furnishing_status = val

            # Full description
            full_desc = None
            desc_tag = soup.find(id=re.compile(r"description", re.I)) or soup.find(class_=re.compile(r"property-description|details-description", re.I))
            if desc_tag:
                full_desc = desc_tag.get_text(separator="\n", strip=True)

            # Images
            images: list[str] = []
            for img in soup.find_all("img", src=True):
                src = img["src"]
                if "pics/" in src and not src.endswith("loading-image-9.gif"):
                    full_img_url = urljoin(LPW_BASE_URL, src)
                    if full_img_url not in images:
                        images.append(full_img_url)

            is_rent = "rental" in full_url.lower() or "lease" in full_url.lower()
            prop_type = "house"
            if "apartment" in full_url.lower() or "apartment" in title.lower():
                prop_type = "apartment"
            elif "land" in full_url.lower() or "land" in title.lower():
                prop_type = "land"
            elif "commercial" in full_url.lower():
                prop_type = "commercial"

            detail = LpwAdDetail(
                id=ad_id,
                title=title,
                url=full_url,
                price=price,
                property_type=prop_type,
                listing_type="rent" if is_rent else "sale",
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                floor_area_sqft=floor_area_sqft,
                land_extent_perches=land_extent_perches,
                furnishing_status=furnishing_status,
                full_description=full_desc,
                poster_name=poster_name,
                phone_number=phone_number,
                agent_type=agent_type,
                images=images,
            )

            await asyncio.sleep(self.delay)
            return detail

        except httpx.HTTPError as e:
            logger.error("http_error_fetching_lpw_detail", error=str(e), url=full_url)
            return None
