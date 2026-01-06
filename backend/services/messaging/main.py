from fastapi import FastAPI
from backend.routes.messaging import router as messaging_router

if __name__ == "__main__":
    app = FastAPI(title="Messaging Service")
    app.include_router(messaging_router, prefix="/messaging")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
