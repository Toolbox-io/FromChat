import os
from fastapi import APIRouter

router = APIRouter()


@router.get("/ice")
async def get_ice_servers():
    """Return ICE server configuration (STUN/TURN) for WebRTC clients.

    Environment variables (comma-separated lists supported):
      - STUN_URLS: e.g. "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
      - TURN_URLS: e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
      - TURN_USERNAME
      - TURN_PASSWORD
    """

    # Prefer using your own coturn for both STUN and TURN
    turn_domain = "fromchat.ru"
    stun_urls = [
        f"stun:{turn_domain}:3478",
        f"stuns:{turn_domain}:5349",
    ]
    # TURN configuration
    # Preferred ways to configure:
    # 1) Explicit URL list: TURN_URLS (comma-separated)
    # 2) Or use TURN_DOMAIN (here defaulting to fromchat.ru) to auto-build URLs
    turn_urls = [
        f"turn:{turn_domain}:3478",
        f"turns:{turn_domain}:5349",
    ]

    turn_username = os.getenv("TURN_USERNAME")
    turn_password = os.getenv("TURN_PASSWORD")

    ice_servers: list[dict] = [{"urls": url} for url in stun_urls]

    if turn_urls and turn_username and turn_password:
        ice_servers.append({
            "urls": turn_urls,
            "username": turn_username,
            "credential": turn_password,
        })

    return {"iceServers": ice_servers}