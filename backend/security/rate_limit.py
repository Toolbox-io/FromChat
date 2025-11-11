from __future__ import annotations

from typing import Callable
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from utils import get_client_ip

# Initialize limiter with IP-based key function
limiter = Limiter(
    key_func=lambda request: get_client_ip(request) or get_remote_address(request),
    default_limits=["10000000000000000000000000000000000/hour"],  # Global default limit
    storage_uri="memory://",  # In-memory storage (can be changed to Redis later)
)


def get_user_id_key(request: Request) -> str:
    """Get rate limit key based on authenticated user ID."""
    user = getattr(getattr(request, "state", None), "current_user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    # Fallback to IP if not authenticated
    return get_client_ip(request) or get_remote_address(request)


def get_ip_key(request: Request) -> str:
    """Get rate limit key based on IP address."""
    return get_client_ip(request) or get_remote_address(request)


# Rate limit decorators for different endpoint types
def rate_limit_per_ip(limit: str) -> Callable:
    """Rate limit based on IP address."""
    return limiter.limit(limit, key_func=get_ip_key)


def rate_limit_per_user(limit: str) -> Callable:
    """Rate limit based on authenticated user ID, fallback to IP.
    
    Note: The user must be authenticated (get_current_user dependency must run first).
    The user will be available in request.state.current_user after authentication.
    """
    return limiter.limit(limit, key_func=get_user_id_key)

