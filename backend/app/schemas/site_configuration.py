from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StringConfigField(BaseModel):
    value: str | None = None
    show: bool = True

from datetime import datetime

class ListConfigField(BaseModel):
    values: list[str] = Field(default_factory=list)
    show: bool = True


from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScanPresetConfig(BaseModel):
    id: str
    name: str
    keyword: str = ""
    categories: list[str] = Field(default_factory=list)
    property_category: str | None = None
    strict_location: bool = True
    scan_all: bool = True
    source: str = "ikman"
    is_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def populate_categories(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cats = data.get("categories")
            prop_cat = data.get("property_category")
            if not cats and prop_cat:
                data["categories"] = [prop_cat]
            elif cats and not prop_cat:
                data["property_category"] = cats[0] if len(cats) == 1 else "multiple"
        return data


DEFAULT_SCAN_PRESETS: list[dict[str, Any]] = [
    {
        "id": "colombo-7-houses",
        "name": "Colombo 7 Residential",
        "keyword": "Colombo 7",
        "categories": ["houses", "apartments"],
        "property_category": "houses",
        "strict_location": True,
        "scan_all": True,
        "source": "ikman",
        "is_default": True,
    },
    {
        "id": "rajagiriya-lands",
        "name": "Rajagiriya Lands & Commercial",
        "keyword": "Rajagiriya",
        "categories": ["lands", "commercial"],
        "property_category": "lands",
        "strict_location": True,
        "scan_all": True,
        "source": "ikman",
        "is_default": True,
    },
    {
        "id": "colombo-apts",
        "name": "Colombo 3 & 4 Apartments",
        "keyword": "Kollupitiya",
        "categories": ["apartments"],
        "property_category": "apartments",
        "strict_location": True,
        "scan_all": True,
        "source": "ikman",
        "is_default": True,
    },
    {
        "id": "battaramulla-homes",
        "name": "Battaramulla Residencies",
        "keyword": "Battaramulla",
        "categories": ["houses", "apartments"],
        "property_category": "houses",
        "strict_location": True,
        "scan_all": True,
        "source": "ikman",
        "is_default": True,
    },
    {
        "id": "colombo-5-lpw",
        "name": "Colombo 5 Homes (LPW)",
        "keyword": "Colombo 5",
        "categories": ["houses"],
        "property_category": "houses",
        "strict_location": True,
        "scan_all": True,
        "source": "lpw",
        "is_default": True,
    },
]


class AutomatedScannerConfig(BaseModel):
    id: str
    name: str
    source: str = "ikman"  # "ikman" | "lpw"
    enabled: bool = True
    frequency_hours: int = Field(default=24, description="Must be 6, 12, 18, or 24")
    pages_to_scan: int = Field(default=5, ge=1, le=50)
    property_types: list[str] = Field(default_factory=lambda: ["house", "apartment"])
    keyword: str | None = None
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None


def get_default_automated_scanners(legacy: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    leg = legacy or {}
    legacy_enabled = leg.get("enabled", False)
    legacy_freq = leg.get("frequency_hours", 24)
    legacy_pages = leg.get("pages_to_scan", 5)
    legacy_types = leg.get("property_types", ["house", "apartment"])
    legacy_last_run = leg.get("last_run_at")
    legacy_last_status = leg.get("last_run_status")
    legacy_next_run = leg.get("next_run_at")

    return [
        {
            "id": "default-ikman",
            "name": "Ikman Portal Scanner",
            "source": "ikman",
            "enabled": legacy_enabled,
            "frequency_hours": legacy_freq,
            "pages_to_scan": legacy_pages,
            "property_types": legacy_types,
            "keyword": None,
            "last_run_at": legacy_last_run,
            "last_run_status": legacy_last_status,
            "next_run_at": legacy_next_run,
        },
        {
            "id": "default-lpw",
            "name": "LankaPropertyWeb Scanner",
            "source": "lpw",
            "enabled": False,
            "frequency_hours": 24,
            "pages_to_scan": 5,
            "property_types": ["house", "apartment"],
            "keyword": None,
            "last_run_at": None,
            "last_run_status": None,
            "next_run_at": None,
        },
    ]


def ensure_default_scanners(settings: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Ensures both legacy and standard default scanners exist in the scanners list."""
    sett = settings or {}
    existing = [dict(s) for s in (sett.get("scanners") or [])]
    existing_ids = {s.get("id") for s in existing if s.get("id")}
    defaults = get_default_automated_scanners(sett)
    for def_sc in defaults:
        if def_sc["id"] not in existing_ids:
            existing.append(def_sc)
    return existing


class ScannerSettingsConfigField(BaseModel):
    enabled: bool = False
    frequency_hours: int = Field(default=24, description="Must be 6, 12, 18, or 24")
    pages_to_scan: int = Field(default=5, ge=1, le=50)
    property_types: list[str] = Field(default_factory=lambda: ["house", "apartment"])
    presets: list[ScanPresetConfig] = Field(default_factory=list)
    scanners: list[AutomatedScannerConfig] = Field(default_factory=list)
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None



class BenchmarkSyncSettingsConfigField(BaseModel):
    enabled: bool = True
    frequency_days: int = Field(default=7, ge=1, le=90, description="Sync frequency in days (1-90)")
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None
    custom_locations: list[str] = Field(default_factory=list)


class SiteConfigurationBase(BaseModel):
    phone_numbers: ListConfigField = Field(default_factory=ListConfigField)
    contact_email: StringConfigField = Field(default_factory=StringConfigField)
    whatsapp: StringConfigField = Field(default_factory=StringConfigField)
    instagram_link: StringConfigField = Field(default_factory=StringConfigField)
    facebook_link: StringConfigField = Field(default_factory=StringConfigField)
    x_link: StringConfigField = Field(default_factory=StringConfigField)
    tiktok_link: StringConfigField = Field(default_factory=StringConfigField)
    city: StringConfigField = Field(default_factory=StringConfigField)
    scanner_settings: ScannerSettingsConfigField = Field(default_factory=ScannerSettingsConfigField)
    benchmark_sync_settings: BenchmarkSyncSettingsConfigField = Field(default_factory=BenchmarkSyncSettingsConfigField)
    extra_settings: dict[str, Any] | None = Field(default_factory=dict)
    prospect_retention_days: int = Field(default=30)


class SiteConfigurationCreate(SiteConfigurationBase):
    pass


class SiteConfigurationUpdate(BaseModel):
    phone_numbers: ListConfigField | None = None
    contact_email: StringConfigField | None = None
    whatsapp: StringConfigField | None = None
    instagram_link: StringConfigField | None = None
    facebook_link: StringConfigField | None = None
    x_link: StringConfigField | None = None
    tiktok_link: StringConfigField | None = None
    city: StringConfigField | None = None
    scanner_settings: ScannerSettingsConfigField | None = None
    benchmark_sync_settings: BenchmarkSyncSettingsConfigField | None = None
    extra_settings: dict[str, Any] | None = None
    prospect_retention_days: int | None = None


class SiteConfigurationResponse(SiteConfigurationBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
