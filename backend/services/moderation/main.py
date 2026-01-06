from fastapi import FastAPI
from backend.routes.moderation import router as moderation_router

if __name__ == "__main__":
    app = FastAPI(title="Moderation Service")
    app.include_router(moderation_router, prefix="/moderation")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
