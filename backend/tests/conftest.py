"""Test fixtures.

The suite runs against in-memory SQLite with `get_db` overridden — no network, no
real database. That is only possible because the model uses `Uuid`, `func.now()`, and
`ARRAY(...).with_variant(JSON(), "sqlite")`.

What this deliberately does NOT cover: the real Postgres ARRAY type, the enum CHECK
constraints, and Numeric fidelity. Those are verified manually against Neon — see
backend/README.md.
"""

import os

# Must precede any `app.` import: Settings has no default for database_url, and
# app.db.session builds the engine at module scope. create_engine() does not connect,
# so a placeholder URL is fine — nothing in the suite touches that engine.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  — registers Property on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.seed import seed_into  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as session:
        yield session


@pytest.fixture
def seeded(db_session: Session) -> Session:
    """The eight real listings, so tests assert against the data that ships."""
    seed_into(db_session)
    db_session.commit()
    return db_session


@pytest.fixture
def client(seeded: Session):
    fastapi_app.dependency_overrides[get_db] = lambda: seeded
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def empty_client(db_session: Session):
    """Client over a migrated-but-empty table."""
    fastapi_app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()
