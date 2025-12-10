import os

DATABASE_URL = "sqlite:///./data/database.db"
JWT_ALGORITHM = "HS256"
# Token inactivity expiration - token expires if not used for this duration
TOKEN_INACTIVITY_EXPIRE_HOURS = 30 * 24  # 30 days of inactivity
# Maximum token lifetime (safety net) - tokens expire after this regardless of usage
MAX_TOKEN_LIFETIME_HOURS = 365 * 24  # 1 year maximum
OWNER_USERNAME = "denis0001-dev"
JWT_SECRET_KEY = os.getenv("JWT_SECRET")
SECURITY_PATCH_TOKEN = os.getenv("SECRET_TOKEN_PATCH_CHANGE_PLEASE","VERYsecure111d")
if not JWT_SECRET_KEY:
    raise ValueError("JWT secret key empty")