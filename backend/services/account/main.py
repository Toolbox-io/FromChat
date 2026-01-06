from fastapi import FastAPI
from backend.routes.account import router as account_router

if __name__ == "__main__":
    app = FastAPI(title="Account Service")
    app.include_router(account_router, prefix="/account")

    import os, uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8301)))
