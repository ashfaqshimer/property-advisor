"""Backend configuration.

Values come from the process environment, falling back to `backend/.env` locally.
`DATABASE_URL` has no default on purpose: a missing connection string should fail
loudly at import rather than silently connecting nowhere.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _with_psycopg_driver(url: str) -> str:
    """Name the driver explicitly.

    Neon hands out `postgresql://...`, which SQLAlchemy resolves to psycopg2 — not
    installed here. Rewriting to `postgresql+psycopg://` picks psycopg3.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Absolute, so alembic, pytest, and `python -m app.db.seed` all read the same
        # file no matter which directory they were launched from.
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str

    # Only needed when database_url points at Neon's `-pooler` endpoint: Alembic runs
    # DDL and wants a plain session rather than PgBouncer transaction pooling.
    migration_database_url: str = ""

    allowed_origins: str = "http://localhost:3000"

    # Agent settings are required so deployment configuration, rather than source code,
    # chooses the model.
    gemini_api_key: str = ""
    gemini_extractor_api_key: str = ""
    gemini_model: str
    google_maps_api_key: str = ""
    location_search_radius_km: float = 5.0

    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_folder: str = "property-advisor"

    auth_cookie_name: str = "property_advisor_session"
    auth_session_days: int = 7
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"

    # Used only by the one-time local bootstrap command.
    bootstrap_admin_secret: str = ""

    @property
    def cloudinary_configured(self) -> bool:
        return all(
            (
                self.cloudinary_cloud_name,
                self.cloudinary_api_key,
                self.cloudinary_api_secret,
            )
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        return _with_psycopg_driver(self.database_url)

    @property
    def migration_sqlalchemy_url(self) -> str:
        return _with_psycopg_driver(self.migration_database_url or self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # pydantic-settings fills from env
