import httpx
import structlog
from typing import Tuple, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.location_cache import LocationCache

logger = structlog.get_logger(__name__)

def geocode_location(db: Session, location_string: str) -> Tuple[Optional[float], Optional[float]]:
    if not location_string or not location_string.strip():
        return None, None
        
    location_string = location_string.strip()
    
    # 1. Check cache
    cache_entry = db.execute(
        select(LocationCache).where(LocationCache.location_string == location_string)
    ).scalar_one_or_none()
    
    if cache_entry:
        return cache_entry.latitude, cache_entry.longitude
        
    # 2. Not in cache, call Google API
    settings = get_settings()
    api_key = settings.google_maps_api_key
    
    # If no API key, we just return None but we do NOT cache the null,
    # so that once an API key is added, it will try again.
    if not api_key:
        logger.warning("geocoding_skipped.no_api_key")
        return None, None
        
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        query = f"{location_string}, Sri Lanka"
        params = {
            "address": query,
            "key": api_key
        }
        
        with httpx.Client(timeout=5.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            lat, lng = None, None
            if data.get("status") == "OK" and data.get("results"):
                location_data = data["results"][0]["geometry"]["location"]
                lat = float(location_data.get("lat"))
                lng = float(location_data.get("lng"))
                
            new_cache = LocationCache(
                location_string=location_string,
                latitude=lat,
                longitude=lng
            )
            db.add(new_cache)
            try:
                db.commit()
            except Exception:
                db.rollback()
                cached = db.execute(
                    select(LocationCache).where(LocationCache.location_string == location_string)
                ).scalar_one_or_none()
                if cached:
                    return cached.latitude, cached.longitude

            return lat, lng
            
    except Exception as e:
        logger.exception("geocoding_failed", location=location_string, error=str(e))
        return None, None
