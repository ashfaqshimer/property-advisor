import pytest
from app.scraper.location_extractor import extract_suburb


def test_extract_suburb_from_title():
    assert extract_suburb("Architecturally Designed Brand New Luxury House For Sale – Piliyandala", district="Colombo") == "Piliyandala"
    assert extract_suburb("NEW TWO STORY HOUSE SALE KADAWATHA NEAR HIGHWAY ENTRANCE", district="Gampaha") == "Kadawatha"
    assert extract_suburb("Spacious Solid House for Sale at - Kotikawatta", district="Colombo") == "Kotikawatta"
    assert extract_suburb("Valuable Residential Land for Sale in Haloluwa, Kandy", district="Kandy") == "Haloluwa"
    assert extract_suburb("3 Bedroom Luxury Townhouse For Sale – The Residence, Thalawathugoda", district="Colombo") == "Thalawathugoda"
    assert extract_suburb("12 P Land for Sale in Ethul Kotte", district="Colombo") == "Ethul Kotte"
    assert extract_suburb("Panadura Land for Sale", district="Kalutara") == "Panadura"
    assert extract_suburb("Two Apartments At Aggona, Rajagiriya For Sale", district="Rajagiriya") == "Aggona"
    assert extract_suburb("Fully Furnished Apartment for Sale - 1st Floor Unit - Homagama", district="Colombo") == "Homagama"
    assert extract_suburb("Apartment For Sale At Colombo 6", district="Colombo 6") == "Colombo 6"
    assert extract_suburb("Apartments for Sale in Nittambuwa", district="Nittambuwa") == "Nittambuwa"
    assert extract_suburb("Land with House for Sale Higurakgoda", district="Polonnaruwa") == "Hingurakgoda"


def test_extract_suburb_normalization():
    assert extract_suburb("House for sale in Colombo 03", district="Colombo") == "Colombo 3"
    assert extract_suburb("Apartment in Colpetty", district="Colombo") == "Kollupitiya"
    assert extract_suburb("Luxury villa in Mt Lavinia", district="Colombo") == "Mount Lavinia"
    assert extract_suburb("Commercial building in Ja Ela", district="Gampaha") == "Ja-Ela"


def test_extract_suburb_from_slug_fallback():
    # When title does not contain suburb, extract from slug
    assert extract_suburb(
        title="Luxury 3 Bedroom Apartment For Sale",
        slug="luxury-3-bedroom-apartment-for-sale-piliyandala-for-sale-colombo-2",
        district="Colombo"
    ) == "Piliyandala"


def test_extract_suburb_ignores_broad_district():
    # Should not treat generic district name as suburb
    assert extract_suburb(
        title="Modern Apartment in Colombo",
        slug="modern-apartment-in-colombo-for-sale-colombo-1",
        district="Colombo"
    ) is None


def test_extract_suburb_handles_none_and_empty():
    assert extract_suburb(None, None, None) is None
    assert extract_suburb("", "", "") is None
