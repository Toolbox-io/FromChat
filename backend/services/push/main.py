from fastapi import FastAPI
from backend.routes.push import router as push_router

if __name__ == "__main__":
    app = FastAPI(title="Push Service")
    app.include_router(push_router, prefix="/push")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
