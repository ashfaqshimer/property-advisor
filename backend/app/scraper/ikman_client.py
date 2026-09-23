import asyncio
import json
import re

import httpx
from bs4 import BeautifulSoup
import structlog

from app.scraper.schemas import IkmanAd, IkmanAdDetail

logger = structlog.get_logger(__name__)

IKMAN_BASE_URL = "https://ikman.lk"

# Regex to find window.initialData = {...};
INITIAL_DATA_RE = re.compile(r"window\.initialData\s*=\s*(\{.*?\});", re.DOTALL)


class IkmanClient:
    def __init__(self, delay: float = 1.0):
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            }
        )
        self.delay = delay

    async def close(self):
        await self.client.aclose()

    def _extract_initial_data(self, html: str) -> dict | None:
        """Extract the window.initialData JSON from the page HTML."""
        match = re.search(r'window\.initialData\s*=\s*({.*?})\s*(?:;)?\s*</script>', html, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.error("Failed to parse initialData JSON")
            return None

    async def fetch_listing_page(self, category_slug: str, page: int = 1) -> list[IkmanAd]:
        """Fetch a page of listings for a category."""
        url = f"{IKMAN_BASE_URL}/en/ads/sri-lanka/{category_slug}"
        params = {}
        if page > 1:
            params["page"] = page

        logger.info("fetching_ikman_listing_page", url=url, page=page)
        
        try:
            response = await self.client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            
            data = self._extract_initial_data(response.text)
            if not data:
                logger.error("initialData not found on listing page", url=url)
                return []
            
            ads_data = data.get("serp", {}).get("ads", {}).get("data", {}).get("ads", [])
            
            ads = []
            for ad_dict in ads_data:
                try:
                    # some list ads might be native ads/banners without id
                    if "id" in ad_dict:
                        ads.append(IkmanAd.model_validate(ad_dict))
                except Exception as e:
                    logger.warning("failed_to_parse_ad", error=str(e), ad_id=ad_dict.get("id"))
            
            await asyncio.sleep(self.delay)
            return ads
            
        except httpx.HTTPError as e:
            logger.error("http_error_fetching_listings", error=str(e), url=url)
            return []

    async def fetch_ad_detail(self, slug: str) -> IkmanAdDetail | None:
        """Fetch full details (including phone number) for a specific ad."""
        url = f"{IKMAN_BASE_URL}/en/ad/{slug}"
        logger.info("fetching_ikman_ad_detail", url=url)
        
        try:
            response = await self.client.get(url, timeout=10.0)
            response.raise_for_status()
            
            data = self._extract_initial_data(response.text)
            if not data:
                logger.error("initialData not found on detail page", url=url)
                return None
            
            ad_dict = data.get("adDetail", {}).get("data", {}).get("ad", {})
            if not ad_dict or "id" not in ad_dict:
                return None
                
            try:
                detail = IkmanAdDetail.model_validate(ad_dict)
                await asyncio.sleep(self.delay)
                return detail
            except Exception as e:
                logger.warning("failed_to_parse_ad_detail", error=str(e), slug=slug)
                return None
                
        except httpx.HTTPError as e:
            logger.error("http_error_fetching_detail", error=str(e), url=url)
            return None
