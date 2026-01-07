import asyncio
import time
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import subprocess
import sys
import os
import httpx
import logging
# Gateway doesn't need direct model access - it's a stateless proxy
# Gateway doesn't need constants - it's a stateless proxy
from backend.shared.utils import get_client_ip

# Gateway doesn't need database access - it's a stateless proxy
from backend.logging_config import access_logger  # noqa: F401 - ensure loggers configured
from backend.security.audit import log_access
from backend.security.rate_limit import limiter
from slowapi.middleware import SlowAPIMiddleware

# Service URL mapping for routing
SERVICE_URLS = {
    "account": os.getenv("ACCOUNT_SERVICE_URL", "http://account_service:8302"),
    "profile": os.getenv("PROFILE_SERVICE_URL", "http://profile_service:8303"),
    "devices": os.getenv("DEVICE_SERVICE_URL", "http://device_service:8304"),
    "messaging": os.getenv("MESSAGING_SERVICE_URL", "http://messaging_service:8305"),
    "push": os.getenv("PUSH_SERVICE_URL", "http://push_service:8306"),
    "webrtc": os.getenv("WEBRTC_SERVICE_URL", "http://webrtc_service:8307"),
    "moderation": os.getenv("MODERATION_SERVICE_URL", "http://moderation_service:8308"),
}

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Gateway is a stateless proxy - no database operations or background tasks needed
    logger.info("Gateway proxy service initialized - routing to microservices")
    yield
    logger.info("Gateway proxy service shutting down.")

# Инициализация FastAPI
app = FastAPI(title="FromChat", lifespan=lifespan)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def access_logging_middleware(request: Request, call_next):
    # Log incoming request and Authorization header presence for debugging auth issues
    try:
        auth_header = request.headers.get("authorization")
        if auth_header:
            short = auth_header[:20] + "..." if len(auth_header) > 20 else auth_header
            logger.info("Incoming request %s %s Authorization=%s", request.method, request.url.path, short)
        else:
            logger.info("Incoming request %s %s Authorization=NONE", request.method, request.url.path)
    except Exception:
        pass
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration = time.perf_counter() - start
        user = getattr(getattr(request, "state", None), "current_user", None)
        log_access(
            "http_error",
            method=request.method,
            path=request.url.path,
            status="error",
            user=getattr(user, "username", None),
            ip=get_client_ip(request),
            duration=f"{duration:.3f}s",
            error=str(exc),
        )
        raise
    else:
        duration = time.perf_counter() - start
        user = getattr(getattr(request, "state", None), "current_user", None)
        log_access(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            user=getattr(user, "username", None),
            ip=get_client_ip(request),
            duration=f"{duration:.3f}s",
        )
        return response


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://fromchat.ru",
        "https://beta.fromchat.ru",
        "https://www.fromchat.ru",
        "http://127.0.0.1:8301",
        "http://127.0.0.1:8300",
        "http://localhost:8301",
        "http://localhost:8300",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Common API endpoints - route to appropriate services (defined first for priority)
@app.api_route("/login", methods=["POST"])
async def login(request: Request):
    """Login endpoint - routes to account service."""
    return await _proxy_to_service("account", "login", request)

@app.api_route("/register", methods=["POST"])
async def register(request: Request):
    """Register endpoint - routes to account service."""
    return await _proxy_to_service("account", "register", request)


# API routes - route to appropriate microservices
@app.api_route("/account/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_account(path: str, request: Request):
    """Proxy account service requests."""
    return await _proxy_to_service("account", path, request)

@app.api_route("/profile/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_profile(path: str, request: Request):
    """Proxy profile service requests."""
    return await _proxy_to_service("profile", path, request)

@app.api_route("/devices/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_devices(path: str, request: Request):
    """Proxy device service requests."""
    return await _proxy_to_service("devices", path, request)

@app.api_route("/messaging/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_messaging(path: str, request: Request):
    """Proxy messaging service requests."""
    return await _proxy_to_service("messaging", path, request)

@app.api_route("/push/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_push(path: str, request: Request):
    """Proxy push service requests."""
    return await _proxy_to_service("push", path, request)

@app.api_route("/webrtc/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_webrtc(path: str, request: Request):
    """Proxy WebRTC service requests."""
    return await _proxy_to_service("webrtc", path, request)

@app.api_route("/moderation/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_moderation(path: str, request: Request):
    """Proxy moderation service requests."""
    return await _proxy_to_service("moderation", path, request)

async def _proxy_to_service(service: str, path: str, request: Request):
    """Helper function to proxy requests to microservices."""
    from fastapi.responses import Response

    service_url = SERVICE_URLS[service]
    target_url = f"{service_url}/{service}/{path}"

    # Get request body
    body = await request.body()

    # Prepare headers (remove host header)
    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=request.query_params,
            )

            # Return response with the same status code and content
            content = response.content
            return Response(
                content=content,
                status_code=response.status_code,
                headers={"content-type": response.headers.get("content-type", "application/json")}
            )
    except httpx.RequestError as exc:
        logging.error(f"Error communicating with {service} service: {exc}")
        raise HTTPException(status_code=503, detail=f"Service {service} unavailable")

# Routes are handled by the catch-all proxy above