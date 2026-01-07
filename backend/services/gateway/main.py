# Gateway service - runs the main gateway app from backend/app.py

if __name__ == "__main__":
    from backend.app import app
    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8300)))
