"""Google Maps geocoding, isolated from the database and agent layers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class GeocodingError(RuntimeError):
    """Google could not complete a geocoding request."""


@dataclass(frozen=True)
class Coordinates:
    latitude: float
    longitude: float


class GoogleGeocoder:
    def __init__(self, api_key: str, opener=urlopen) -> None:
        self.api_key = api_key
        self._opener = opener

    def geocode(self, location: str) -> Coordinates | None:
        if not self.api_key:
            raise GeocodingError("Google Maps API key is not configured")

        params = urlencode({"address": location, "key": self.api_key})
        request = Request(
            f"https://maps.googleapis.com/maps/api/geocode/json?{params}",
            headers={"Accept": "application/json"},
        )
        try:
            with self._opener(request, timeout=10) as response:
                payload = json.load(response)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            raise GeocodingError("Google Maps geocoding request failed") from exc

        status = payload.get("status")
        if status == "ZERO_RESULTS":
            return None
        if status != "OK":
            raise GeocodingError(f"Google Maps geocoding returned {status!r}")

        try:
            location_data = payload["results"][0]["geometry"]["location"]
            latitude = float(location_data["lat"])
            longitude = float(location_data["lng"])
        except (IndexError, KeyError, TypeError, ValueError) as exc:
            raise GeocodingError("Google Maps returned an invalid geocoding result") from exc

        return Coordinates(latitude=latitude, longitude=longitude)