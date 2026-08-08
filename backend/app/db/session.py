"""Engine, session factory, and the FastAPI dependency that hands out sessions."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

# create_engine() resolves the dialect and imports the driver, but does not connect —
# so building this at module scope is safe even when the database is unreachable.
engine = create_engine(
    get_settings().sqlalchemy_url,
    # Neon suspends idle compute. Without pre-ping the first request after a suspend
    # fails with a stale-connection OperationalError instead of quietly reconnecting.
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_recycle=300,
)

# expire_on_commit=False so the seed script can still read attributes off objects it
# just committed without triggering a fresh SELECT per attribute.
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
