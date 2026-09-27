"""Rate limiter setup using slowapi."""

from fastapi import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """Extract client IP, inspecting X-Forwarded-For if behind a proxy/load balancer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=get_client_ip)
