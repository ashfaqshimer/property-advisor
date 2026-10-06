"""Pydantic schemas for market benchmarks and valuation calculations."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MarketBenchmarkRead(BaseModel):
    id: UUID
    location: str
    property_type: str
    listing_type: str
    rate_per_sqft: Decimal | None = None
    rate_per_perch: Decimal | None = None
    status: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BenchmarkSyncRequest(BaseModel):
    locations: list[str] | None = None
    background: bool = True


class BenchmarkSyncResponse(BaseModel):
    message: str
    job_started: bool


class BenchmarkCalculationRequest(BaseModel):
    location: str
    property_type: str = Field(description="house, apartment, land, commercial")
    listing_type: str = Field(default="sale", description="sale, rent")
    price: float = Field(gt=0, description="Asking price in LKR")
    floor_area_sqft: float | None = Field(default=None, gt=0)
    land_size_perches: float | None = Field(default=None, gt=0)


class BenchmarkCalculationResponse(BaseModel):
    has_benchmark: bool
    benchmark_location: str | None = None
    rate_per_sqft: float | None = None
    rate_per_perch: float | None = None
    expected_price: float | None = None
    actual_price: float | None = None
    percentage_delta: float | None = None
    position: str | None = None
    summary: str
