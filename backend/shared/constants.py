import os

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/database.db")

# JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET", "default-jwt-secret-for-development")
JWT_ALGORITHM = "HS256"
# Token inactivity expiration - token expires if not used for this duration
TOKEN_INACTIVITY_EXPIRE_HOURS = 30 * 24  # 30 days of inactivity
# Maximum token lifetime (safety net) - tokens expire after this regardless of usage
MAX_TOKEN_LIFETIME_HOURS = 365 * 24  # 1 year maximum

# Owner user
OWNER_USERNAME = os.getenv("OWNER_USERNAME", "owner")

# Push notifications
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")

# Rate limiting
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

# File uploads
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".avi", ".mp3", ".wav"}

# WebSocket
WEBSOCKET_PING_INTERVAL = 30
WEBSOCKET_PING_TIMEOUT = 60

# Encryption
ENCRYPTION_KEY_LENGTH = 32
ENCRYPTION_NONCE_LENGTH = 12

# Moderation
PROFANITY_THRESHOLD = float(os.getenv("PROFANITY_THRESHOLD", "0.8"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.85"))

# WebRTC
WEBRTC_ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"}
]

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
