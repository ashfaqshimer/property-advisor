from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent.client import GeminiNotConfigured
from app.api import chat, properties
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="Property Advisor API")

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
app.include_router(chat.router)


@app.exception_handler(GeminiNotConfigured)
def gemini_not_configured(_request: Request, exc: GeminiNotConfigured) -> JSONResponse:
    """A missing GEMINI_API_KEY is a deployment problem, not a bad request.

    Handled at app level rather than inside the endpoint because the client is built in a
    dependency, which resolves before the route function runs — a try/except in the body
    would never see this. 503 with the exception's own actionable text, which names the
    variable and where to get a key.
    """
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/health")
def health() -> dict[str, str]:
    """Smoke-test route: confirms the app boots and routing works."""
    return {"status": "ok"}
