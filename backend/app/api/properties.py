"""Property read endpoints."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import queries
from app.db.session import get_db
from app.models.property import Property
from app.schemas.property import PropertyRead

router = APIRouter(prefix="/properties", tags=["properties"])

DbSession = Annotated[Session, Depends(get_db)]


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
