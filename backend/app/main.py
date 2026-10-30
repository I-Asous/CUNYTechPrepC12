"""Entry point for the coaching API.

Run from the backend folder with:
    uvicorn app.main:app --reload --port 8000

The frontend's dev server forwards every /api request here (see frontend/vite.config.js).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import engine
from app.routes import router


@asynccontextmanager
async def lifespan(app):
    yield
    engine.close()  # stop the Stockfish subprocess


app = FastAPI(title="Chess Coach API", lifespan=lifespan)
app.include_router(router, prefix="/api")
