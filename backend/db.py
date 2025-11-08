import os
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from constants import DATABASE_URL

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "40"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

POOL_CONFIG = {
    "pool_size": POOL_SIZE,
    "max_overflow": MAX_OVERFLOW,
    "pool_recycle": POOL_RECYCLE,
    "pool_timeout": POOL_TIMEOUT,
    "pool_pre_ping": True,
}

engine_kwargs = {
    "pool_size": POOL_SIZE,
    "max_overflow": MAX_OVERFLOW,
    "pool_recycle": POOL_RECYCLE,
    "pool_pre_ping": True,
    "pool_timeout": POOL_TIMEOUT,
}

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)