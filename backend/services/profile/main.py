from fastapi import FastAPI
from backend.routes.profile import router as profile_router

if __name__ == "__main__":
    app = FastAPI(title="Profile Service")
    app.include_router(profile_router, prefix="/profile")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
