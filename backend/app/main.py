import time
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agent.client import GeminiNotConfigured
from app.api import auth, chat, leads, properties, property_contacts, site_configuration, prospects, field_assignments, telegram, market_values
from app.config import get_settings

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()

from contextlib import asynccontextmanager
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from slowapi import _rate_limit_exceeded_handler
import uuid
from slowapi.errors import RateLimitExceeded

from app.db.session import get_db
from app.limiter import get_client_ip, limiter
from app.services.scanner_scheduler import init_scheduler, shutdown_scheduler

settings = get_settings()

if settings.sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_environment,
            traces_sample_rate=0.1,
        )
        logger.info("sentry_initialized", environment=settings.app_environment)
    except Exception as exc:  # noqa: BLE001
        logger.warning("sentry_init_failed", error=str(exc))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the apscheduler background tasks
    init_scheduler()
    yield
    # Shutdown the scheduler on exit
    shutdown_scheduler()

app = FastAPI(title="Property Advisor API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    client_ip = get_client_ip(request)
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000
    response.headers["x-request-id"] = request_id

    logger.info(
        "http_request",
        request_id=request_id,
        client_ip=client_ip,
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
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT"],
    allow_headers=["Content-Type"],
)

app.include_router(properties.router)
app.include_router(properties.admin_router)
app.include_router(property_contacts.router)
app.include_router(site_configuration.router)
app.include_router(site_configuration.admin_router)
app.include_router(leads.public_router)
app.include_router(leads.router)
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(auth.admin_router)
app.include_router(prospects.admin_router)
app.include_router(field_assignments.router)
app.include_router(telegram.router)
app.include_router(market_values.router)
app.include_router(market_values.admin_router)


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
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Smoke-test route: confirms the app boots, routing works, and DB responds."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
