import time
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent.client import GeminiNotConfigured
from app.api import auth, chat, leads, properties
from app.config import get_settings

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()

settings = get_settings()

app = FastAPI(title="Property Advisor API")

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000
    
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(properties.router)
app.include_router(properties.admin_router)
app.include_router(leads.public_router)
app.include_router(leads.router)
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(auth.admin_router)


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
