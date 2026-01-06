import os
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine
from .constants import DATABASE_URL

# Database connection settings
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

def create_engine_from_url(database_url: str):
    """Create SQLAlchemy engine from database URL."""
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine_kwargs = {
        "pool_size": POOL_SIZE,
        "max_overflow": MAX_OVERFLOW,
        "pool_recycle": POOL_RECYCLE,
        "pool_pre_ping": True,
        "pool_timeout": POOL_TIMEOUT,
    }

    engine = create_engine(
        database_url,
        connect_args=connect_args,
        **engine_kwargs,
    )

    return engine

# Create engine - this should be called by each service with its own DATABASE_URL
def get_engine(database_url: str = None):
    """Get SQLAlchemy engine for the given database URL."""
    url = database_url or DATABASE_URL
    return create_engine_from_url(url)

# Session factory - create per service
def get_session_factory(database_url: str = None):
    """Get session factory for the given database URL."""
    engine = get_engine(database_url)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency for FastAPI - create per service
def get_db(database_url: str = None):
    """FastAPI dependency to get database session."""
    SessionLocal = get_session_factory(database_url)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
