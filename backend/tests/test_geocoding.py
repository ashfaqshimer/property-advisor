import io
import json

import pytest

from app.geocoding import GeocodingError, GoogleGeocoder


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return io.TextIOWrapper(io.BytesIO(json.dumps(self.payload).encode()))

    def __exit__(self, *_):
        return False


def test_google_geocoder_returns_coordinates():
    geocoder = GoogleGeocoder(
        "secret",
        opener=lambda _request, timeout: FakeResponse(
            {
                "status": "OK",
                "results": [
                    {"geometry": {"location": {"lat": 6.89, "lng": 79.87}}}
                ],
            }
        ),
    )

    result = geocoder.geocode("Havelock City")

    assert result.latitude == 6.89
    assert result.longitude == 79.87


def test_google_geocoder_returns_none_for_zero_results():
    geocoder = GoogleGeocoder(
        "secret",
        opener=lambda _request, timeout: FakeResponse({"status": "ZERO_RESULTS"}),
    )

    assert geocoder.geocode("Not A Real Place") is None


@pytest.mark.parametrize("status", ["REQUEST_DENIED", "OVER_QUERY_LIMIT"])
def test_google_geocoder_raises_for_api_errors(status):
    geocoder = GoogleGeocoder(
        "secret",
        opener=lambda _request, timeout: FakeResponse({"status": status}),
    )

    with pytest.raises(GeocodingError):
        geocoder.geocode("Colombo")


def test_google_geocoder_requires_an_api_key():
    with pytest.raises(GeocodingError):
        GoogleGeocoder("").geocode("Colombo")


def test_google_geocoder_restricts_to_sri_lanka():
    captured_request = []

    def fake_opener(request, timeout):
        captured_request.append(request)
        return FakeResponse(
            {
                "status": "OK",
                "results": [
                    {"geometry": {"location": {"lat": 6.89, "lng": 79.87}}, "types": ["premise"]}
                ],
            }
        )

    geocoder = GoogleGeocoder("secret", opener=fake_opener)
    geocoder.geocode("Havelock Residences")

    assert len(captured_request) == 1
    assert "components=country%3ALK" in captured_request[0].full_url


def test_google_geocoder_returns_none_for_country_centroid_fallback():
    geocoder = GoogleGeocoder(
        "secret",
        opener=lambda _request, timeout: FakeResponse(
            {
                "status": "OK",
                "results": [
                    {
                        "geometry": {"location": {"lat": 7.87, "lng": 80.77}},
                        "types": ["country", "political"],
                    }
                ],
            }
        ),
    )

    assert geocoder.geocode("Unknown Building Name") is None