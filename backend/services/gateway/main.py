from fastapi import FastAPI

# Gateway service - handles complex operations that Caddy cannot
# This will be expanded later with routing logic to other services

if __name__ == "__main__":
    app = FastAPI(title="Gateway Service")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
