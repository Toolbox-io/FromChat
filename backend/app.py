from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
from migration import run_migrations

from routes import account, messaging, profile, push

# Configure logging
logger = logging.getLogger("uvicorn.error")
logger.handlers.clear()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application lifespan events."""
    # Startup
    try:
        logger.info("Starting database migration check...")
        run_migrations()
        logger.info("Database migrations completed successfully.")
    except Exception as e:
        logger.error(f"Failed to run database migrations: {e}")
        raise
    
    yield
    
    # Shutdown (if needed in the future)
    # logger.info("Application shutdown")

# Инициализация FastAPI
app = FastAPI(title="FromChat", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене замените на нужные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(account.router)
app.include_router(messaging.router)
app.include_router(profile.router)
app.include_router(push.router, prefix="/push")