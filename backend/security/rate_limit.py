from __future__ import annotations

from typing import Callable
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from utils import get_client_ip

def get_ip_key(request: Request) -> str:
    """Get rate limit key based on IP address."""
    return get_client_ip(request) or get_remote_address(request)

# Initialize limiter with IP-based key function
# Note: We don't set default_limits to avoid affecting all users if one IP is attacked.
# Each endpoint should have an explicit rate limit based on its sensitivity.
limiter = Limiter(
    key_func=get_ip_key,
    default_limits=[],  # No global default - each endpoint must have explicit limits
    storage_uri="memory://",  # In-memory storage (can be changed to Redis later)
)


# Rate limit decorator for IP-based limiting
def rate_limit_per_ip(limit: str) -> Callable:
    """Rate limit based on IP address."""
    return limiter.limit(limit, key_func=get_ip_key)