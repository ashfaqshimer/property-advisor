from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import properties
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="Home Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # No cookies or auth headers cross origins here. Must stay False if the origin
    # list ever becomes "*".
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(properties.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Smoke-test route: confirms the app boots and routing works."""
    return {"status": "ok"}
