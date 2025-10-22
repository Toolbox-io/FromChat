from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import subprocess
import sys
import os
from constants import DATABASE_URL
from routes import account, messaging, profile, push, webrtc
import logging
from models import User
from constants import OWNER_USERNAME
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - run migration in separate process to avoid logging interference
    try:
        logger.info("Starting database migration check...")
        # Run migration in a separate process
        subprocess.run(
            [
                sys.executable, 
                "-c", 
                "import sys; sys.path.append('.'); from migration import run_migrations; run_migrations()"
            ], 
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
    except Exception as e:
        logger.error(f"Failed to run database migrations: {e}")
        raise
    
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        with SessionLocal() as db:
            # Find the owner user
            owner = db.query(User).filter(User.username == OWNER_USERNAME).first()
            if owner and not owner.verified:
                owner.verified = True
                db.commit()
                logger.info(f"Owner user '{OWNER_USERNAME}' has been verified")
            elif owner and owner.verified:
                logger.info(f"Owner user '{OWNER_USERNAME}' is already verified")
            else:
                logger.warning(f"Owner user '{OWNER_USERNAME}' not found")
                
    except Exception as e:
        logger.error(f"Failed to ensure owner verification: {e}")
    
    # Start the messaging cleanup task
    try:
        from routes.messaging import messagingManager
        messagingManager.start_cleanup_task()
        logger.info("Messaging cleanup task started")
    except Exception as e:
        logger.error(f"Failed to start messaging cleanup task: {e}")
    
    yield
    
    # Shutdown (if needed in the future)

# Инициализация FastAPI
app = FastAPI(title="FromChat", lifespan=lifespan)

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

# Routes
app.include_router(account.router)
app.include_router(messaging.router)
app.include_router(profile.router)
app.include_router(push.router, prefix="/push")
app.include_router(webrtc.router, prefix="/webrtc")