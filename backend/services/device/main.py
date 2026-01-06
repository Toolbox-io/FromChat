from fastapi import FastAPI
from backend.routes.devices import router as device_router

if __name__ == "__main__":
    app = FastAPI(title="Device Service")
    app.include_router(device_router, prefix="/devices")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
