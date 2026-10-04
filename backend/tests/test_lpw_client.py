import asyncio
from unittest.mock import AsyncMock, patch
import uuid
import httpx
import pytest

from app.scraper.lpw_client import LankaPropertyWebClient
from app.scraper.classifier import classify_lpw_listing_heuristics
from app.scraper.schemas import LpwAd, LpwAdDetail
from app.schemas.prospect import ScanRequest
from app.api.prospects import _save_prospects_sync, _run_lpw_scan_job
from app.models.prospect import Prospect
from app.models.scan_job import ScanJob


SAMPLE_LPW_SEARCH_HTML = """
<!DOCTYPE html>
<html>
<body>
<article class="listing-item" data-ad-id="5944600">
  <a class="listing-header" href="/sale/property_details-5944600.html">
    <span class="location">Colombo 5</span>
  </a>
  <div class="listing-summery">
    <div class="d-flex">
      <ul>
        <li><span class="count">4</span></li>
        <li><span class="count">2,200</span><span class="unit">sqft</span></li>
        <li><span class="type">House</span></li>
      </ul>
    </div>
  </div>
  <div class="listing-body">
    <div class="listing-price">Rs. 135M <span class="span_psf">Negotiable</span></div>
    <h4 class="listing-title">
      <a href="/sale/property_details-5944600.html">Spacious House in Colombo 5</a>
    </h4>
    <h5 class="listing-address">Evergreen Road, Colombo 5</h5>
    <p class="listing-description">A beautiful family home in prime location more »</p>
  </div>
  <div class="listing-footer">
    <div class="agent-logo"></div>
  </div>
</article>

<article class="listing-item" data-ad-id="5910474">
  <a class="listing-header" href="/sale/property_details-5910474.html">
    <span class="location">Colombo 6</span>
  </a>
  <div class="listing-summery">
    <div class="d-flex">
      <ul>
        <li><span class="count">3</span></li>
        <li><span class="count">1,500</span><span class="unit">sqft</span></li>
        <li><span class="type">Apartment</span></li>
      </ul>
    </div>
  </div>
  <div class="listing-body">
    <div class="listing-price">Rs. 45M</div>
    <h4 class="listing-title">
      <a href="/sale/property_details-5910474.html">Luxury Apartment in Wellawatte</a>
    </h4>
    <h5 class="listing-address">Marine Drive, Colombo 6</h5>
    <p class="listing-description">Prime sea view apartment for sale.</p>
  </div>
  <div class="listing-footer">
    <div class="agent-logo">
      <img src="/pics/agents/agency123.jpg" alt="Agency Logo"/>
    </div>
  </div>
</article>
</body>
</html>
"""

SAMPLE_LPW_DETAIL_HTML = """
<!DOCTYPE html>
<html>
<head>
  <title>House for Sale in Colombo 5</title>
</head>
<body>
  <h1>Spacious House in Colombo 5</h1>
  <div class="listing-price">Rs. 135M</div>
  <span class="agent-type-label">Owner</span>
  <div class="phone-info">Nishantha : 94-777251390</div>
  <a href="tel:+94-777251390">Call Now</a>
  
  <div class="overview-item">Bedrooms | 4</div>
  <div class="overview-item">Bathrooms | 3</div>
  <div class="overview-item">Floor area | 2,200 sq.ft.</div>
  <div class="overview-item">Area of land | 8.5 perches</div>
  <div class="overview-item">Furnishing Status | Semi Furnished</div>

  <div id="description">
    Full description of this rare luxury home on Evergreen Road.
  </div>

  <img src="https://www.lankapropertyweb.com/pics/5944600/photo1.jpg"/>
  <img src="https://www.lankapropertyweb.com/pics/5944600/photo2.jpg"/>
</body>
</html>
"""


def test_lpw_client_config():
    async def _run():
        client = LankaPropertyWebClient(delay=0)
        try:
            assert client.client.follow_redirects is True
            assert "User-Agent" in client.client.headers
        finally:
            await client.close()

    asyncio.run(_run())


def test_lpw_fetch_listing_page_parsing():
    async def _run():
        client = LankaPropertyWebClient(delay=0)
        mock_response = httpx.Response(
            status_code=200,
            text=SAMPLE_LPW_SEARCH_HTML,
            request=httpx.Request("GET", "https://www.lankapropertyweb.com/sale/index.php"),
        )
        try:
            with patch.object(client.client, "get", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_response
                ads, has_more = await client.fetch_listing_page(category="House", page=1)

                assert len(ads) == 2
                assert has_more is True

                # First ad: Private Owner signal
                ad1 = ads[0]
                assert ad1.id == "5944600"
                assert "Spacious House in Colombo 5" in ad1.title
                assert "135M" in ad1.price
                assert ad1.suburb == "Colombo 5"
                assert ad1.bedrooms == 4
                assert ad1.floor_area_sqft == 2200.0
                assert ad1.has_agent_logo is False

                # Second ad: Agency logo signal
                ad2 = ads[1]
                assert ad2.id == "5910474"
                assert "Luxury Apartment" in ad2.title
                assert ad2.bedrooms == 3
                assert ad2.floor_area_sqft == 1500.0
                assert ad2.has_agent_logo is True
        finally:
            await client.close()

    asyncio.run(_run())


def test_lpw_fetch_ad_detail_parsing():
    async def _run():
        client = LankaPropertyWebClient(delay=0)
        mock_response = httpx.Response(
            status_code=200,
            text=SAMPLE_LPW_DETAIL_HTML,
            request=httpx.Request("GET", "https://www.lankapropertyweb.com/sale/property_details-5944600.html"),
        )
        try:
            with patch.object(client.client, "get", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_response
                detail = await client.fetch_ad_detail("https://www.lankapropertyweb.com/sale/property_details-5944600.html")

                assert detail is not None
                assert detail.id == "5944600"
                assert detail.phone_number == "+94-777251390"
                assert detail.poster_name == "Nishantha"
                assert detail.agent_type == "Owner"
                assert detail.bedrooms == 4
                assert detail.bathrooms == 3
                assert detail.floor_area_sqft == 2200.0
                assert detail.land_extent_perches == 8.5
                assert detail.furnishing_status == "Semi Furnished"
                assert "Full description" in detail.full_description
                assert len(detail.images) == 2
        finally:
            await client.close()

    asyncio.run(_run())


def test_lpw_classification_heuristics():
    ad_private = LpwAd(
        id="101",
        title="House for sale",
        url="https://www.lankapropertyweb.com/sale/property_details-101.html",
        has_agent_logo=False,
    )
    ad_agency = LpwAd(
        id="102",
        title="House for sale",
        url="https://www.lankapropertyweb.com/sale/property_details-102.html",
        has_agent_logo=True,
    )
    detail_owner = LpwAdDetail(
        id="101",
        title="House for sale",
        url="https://www.lankapropertyweb.com/sale/property_details-101.html",
        agent_type="Owner",
    )
    detail_agent = LpwAdDetail(
        id="102",
        title="House for sale",
        url="https://www.lankapropertyweb.com/sale/property_details-102.html",
        agent_type="Agent",
    )

    # Search-card level
    cls1, conf1, reas1 = classify_lpw_listing_heuristics(ad_private)
    assert cls1 == "owner"

    cls2, conf2, reas2 = classify_lpw_listing_heuristics(ad_agency)
    assert cls2 == "broker"
    assert "lpw_agency_logo_detected" in reas2

    # Detail-level explicit label
    cls3, conf3, reas3 = classify_lpw_listing_heuristics(ad_private, detail=detail_owner)
    assert cls3 == "owner"
    assert conf3 == 95
    assert "lpw_explicit_owner_tag" in reas3

    cls4, conf4, reas4 = classify_lpw_listing_heuristics(ad_agency, detail=detail_agent)
    assert cls4 == "broker"
    assert conf4 == 95
    assert "lpw_explicit_agent_tag" in reas4


def test_lpw_save_and_prospect_provenance(db_session, monkeypatch):
    monkeypatch.setattr("app.api.prospects.geocode_location", lambda db, target: (6.89, 79.87))
    monkeypatch.setattr("app.api.prospects.SessionLocal", lambda: db_session)
    ad = LpwAd(
        id="5944600",
        title="Spacious House in Colombo 5",
        url="https://www.lankapropertyweb.com/sale/property_details-5944600.html",
        price="Rs. 135M",
        location="Evergreen Road, Colombo 5",
        suburb="Colombo 5",
        property_type="house",
        listing_type="sale",
        bedrooms=4,
        floor_area_sqft=2200.0,
        has_agent_logo=False,
    )
    req = ScanRequest(source="lpw", categories=["houses"])
    found, new_cnt, known_cnt, filtered_cnt = _save_prospects_sync([ad], req)

    assert found == 1
    assert new_cnt == 1

    # Verify saved Prospect record in DB
    p = db_session.query(Prospect).filter(Prospect.source == "lpw", Prospect.source_id == "5944600").first()
    assert p is not None
    assert p.source == "lpw"
    assert p.source_id == "5944600"
    assert p.source_url == "https://www.lankapropertyweb.com/sale/property_details-5944600.html"
    assert p.ikman_ad_id == "lpw-5944600"
    assert p.classification == "owner"
    assert p.suburb == "Colombo 5"
