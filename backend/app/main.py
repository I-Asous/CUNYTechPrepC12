"""Entry point for the coaching API.

Run from the backend folder with:
    uvicorn app.main:app --reload --port 8000

The frontend's dev server forwards every /api request here (see frontend/vite.config.js).
"""

from fastapi import FastAPI

from app.routes import router

app = FastAPI(title="Chess Coach API")
app.include_router(router, prefix="/api")
