"""Test fixtures.

The suite runs against in-memory SQLite with `get_db` overridden — no network, no
real database. That is only possible because the models use `Uuid`, `func.now()`,
`ARRAY(...).with_variant(JSON(), "sqlite")`, and a dialect-agnostic `JSON`.

SQLite covers more than it first appears to. It enforces UNIQUE, it enforces CHECK
constraints — so the enum `values_callable` trap is catchable here, not only against
Neon — and it enforces foreign keys once `_enforce_foreign_keys` sets the pragma below.

What this genuinely does NOT cover: the real Postgres ARRAY type, `Numeric` Decimal
fidelity (SQLite has no native Decimal), and whether the shipped Postgres DDL matches
what the models intend. Those are verified manually against Neon — see backend/README.md.
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
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  — registers Property on Base.metadata
from app.api.chat import get_agent_client  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.seed import seed_into  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


def _enforce_foreign_keys(engine: Engine) -> None:
    """SQLite ignores foreign keys unless asked, per connection.

    Without this, `ON DELETE CASCADE` is inert: deleting a conversation leaves its
    messages behind, so a cascade test fails looking like a broken model rather than an
    unenforced pragma. `properties` has no foreign keys, so turning this on changes
    nothing for the tests that predate it.
    """

    @event.listens_for(engine, "connect")
    def _set_pragma(dbapi_connection, _connection_record):  # pragma: no cover - hook
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _enforce_foreign_keys(engine)
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


@pytest.fixture
def chat_client(seeded: Session):
    """Factory: hands back a TestClient wired to a scripted stand-in for Gemini.

    A factory rather than a plain fixture because each test scripts its own model
    responses. Overriding `get_agent_client` is what keeps the suite off the network
    without patching anything — `POST /chat` resolves its client through that dependency.
    """

    def build(fake) -> TestClient:
        fastapi_app.dependency_overrides[get_db] = lambda: seeded
        fastapi_app.dependency_overrides[get_agent_client] = lambda: fake
        return TestClient(fastapi_app)

    yield build
    fastapi_app.dependency_overrides.clear()
