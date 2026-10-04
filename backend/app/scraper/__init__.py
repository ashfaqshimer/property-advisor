"""Scraper module for fetching and classifying property listings."""

from app.scraper.ikman_client import IkmanClient, IKMAN_BASE_URL
from app.scraper.lpw_client import LankaPropertyWebClient, LPW_BASE_URL

__all__ = ["IkmanClient", "IKMAN_BASE_URL", "LankaPropertyWebClient", "LPW_BASE_URL"]
