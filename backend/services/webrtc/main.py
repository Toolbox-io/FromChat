from fastapi import FastAPI
from backend.routes.webrtc import router as webrtc_router

if __name__ == "__main__":
    app = FastAPI(title="WebRTC Service")
    app.include_router(webrtc_router, prefix="/webrtc")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
