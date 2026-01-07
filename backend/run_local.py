#!/usr/bin/env python3
"""
Local development server that runs all services in a single FastAPI application.
This provides the same monolithic experience as before, but with microservice separation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Import service routers
from backend.routes.account import router as account_router
from backend.routes.profile import router as profile_router
from backend.routes.devices import router as device_router
from backend.routes.messaging import router as messaging_router
from backend.routes.push import router as push_router
from backend.routes.webrtc import router as webrtc_router
from backend.routes.moderation import router as moderation_router

# Import security modules
from security.audit import log_access
from security.rate_limit import limiter
from slowapi.middleware import SlowAPIMiddleware

# Create main FastAPI app
app = FastAPI(title="FromChat Local Development")

# Add rate limiting middleware
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS middleware
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

# Mount service routers with appropriate prefixes
app.include_router(account_router, prefix="/account")
app.include_router(profile_router, prefix="/profile")
app.include_router(device_router, prefix="/devices")
app.include_router(messaging_router, prefix="/messaging")
app.include_router(push_router, prefix="/push")
app.include_router(webrtc_router, prefix="/webrtc")
app.include_router(moderation_router, prefix="/moderation")

if __name__ == "__main__":
    # Run the server
    port = int(os.getenv("PORT", "8301"))
    host = os.getenv("HOST", "127.0.0.1")

    print(f"Starting FromChat local development server on {host}:{port}")
    print("Available services:")
    print("  - Account: http://127.0.0.1:8301/account/")
    print("  - Profile: http://127.0.0.1:8301/profile/")
    print("  - Devices: http://127.0.0.1:8301/devices/")
    print("  - Messaging: http://127.0.0.1:8301/messaging/")
    print("  - Push: http://127.0.0.1:8301/push/")
    print("  - WebRTC: http://127.0.0.1:8301/webrtc/")
    print("  - Moderation: http://127.0.0.1:8301/moderation/")

    uvicorn.run(
        "run_local:app",
        host=host,
        port=port,
        reload=True,
        reload_dirs=["backend"]
    )
