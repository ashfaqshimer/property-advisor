"""Settings behaviour — the failure modes that would otherwise surface as a
confusing connection error much later.
"""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**overrides: str) -> Settings:
    # _env_file=None so a developer's real backend/.env can't influence the result.
    return Settings(_env_file=None, **overrides)  # type: ignore[arg-type]


def test_missing_database_url_fails_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        _settings()


def test_missing_gemini_model_fails_loudly() -> None:
    with pytest.raises(ValidationError):
        _settings(database_url="postgresql://u:p@host/db")


def test_gemini_model_comes_from_configuration() -> None:
    settings = _settings(
        database_url="postgresql://u:p@host/db",
        gemini_model="gemini-3.1-flash",
    )

    assert settings.gemini_model == "gemini-3.1-flash"


def test_neon_url_is_rewritten_to_psycopg3() -> None:
    # SQLAlchemy resolves a bare postgresql:// to psycopg2, which isn't installed.
    settings = _settings(
        database_url="postgresql://u:p@host/db?sslmode=require",
        gemini_model="gemini-test",
    )

    assert settings.sqlalchemy_url == "postgresql+psycopg://u:p@host/db?sslmode=require"


def test_legacy_postgres_scheme_is_also_rewritten() -> None:
    settings = _settings(
        database_url="postgres://u:p@host/db",
        gemini_model="gemini-test",
    )

    assert settings.sqlalchemy_url == "postgresql+psycopg://u:p@host/db"


def test_migrations_fall_back_to_the_main_url() -> None:
    settings = _settings(
        database_url="postgresql://u:p@host/db",
        gemini_model="gemini-test",
    )

    assert settings.migration_sqlalchemy_url == settings.sqlalchemy_url


def test_migrations_prefer_the_direct_url_when_set() -> None:
    settings = _settings(
        database_url="postgresql://u:p@host-pooler/db",
        migration_database_url="postgresql://u:p@host/db",
        gemini_model="gemini-test",
    )

    assert "-pooler" not in settings.migration_sqlalchemy_url
    assert "-pooler" in settings.sqlalchemy_url


def test_allowed_origins_splits_and_strips() -> None:
    settings = _settings(
        database_url="postgresql://u:p@host/db",
        allowed_origins="http://localhost:3000, https://example.vercel.app ,",
        gemini_model="gemini-test",
    )

    assert settings.cors_origins == [
        "http://localhost:3000",
        "https://example.vercel.app",
    ]
