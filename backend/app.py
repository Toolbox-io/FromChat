from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import subprocess
import sys
import os

from routes import account, messaging, profile, push, webrtc

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - run migration in separate process to avoid logging interference
    try:
        print("Starting database migration check...")
        # Run migration in a separate process
        subprocess.run(
            [
                sys.executable, 
                "-c", 
                "import sys; sys.path.append('.'); from migration import run_migrations; run_migrations()"
            ], 
            cwd=os.path.dirname(os.path.abspath(__file__))
            # No capture_output - let it stream to terminal in real-time
            # No text=True - let it use the terminal's encoding
        )
    except Exception as e:
        print(f"Failed to run database migrations: {e}")
        raise
    
    yield
    
    # Shutdown (if needed in the future)
    # logger.info("Application shutdown")

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