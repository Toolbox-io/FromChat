from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from migration import run_auto_migration
from db import engine

from routes import account, messaging, profile, push

# Инициализация FastAPI
app = FastAPI(title="PixelChat")

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


@app.on_event("startup")
def _auto_migrate_on_startup():
    try:
        run_auto_migration(engine)
    except Exception:
        # Keep startup resilient; errors should be visible in server logs
        pass