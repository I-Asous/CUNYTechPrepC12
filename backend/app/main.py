"""Entry point for the coaching API.

Run from the backend folder with:
    uvicorn app.main:app --reload --port 8000

The frontend's dev server forwards every /api request here (see frontend/vite.config.js).

In production (see the Dockerfile) this server also serves the built frontend
from frontend/dist, so the site and the API share one origin. Set FRONTEND_DIST
to serve it from somewhere else.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import engine
from app.routes import router

FRONTEND_DIST = Path(
    os.environ.get("FRONTEND_DIST")
    or Path(__file__).resolve().parents[2] / "frontend" / "dist"
)


@asynccontextmanager
async def lifespan(app):
    yield
    engine.close()  # stop the Stockfish subprocess


app = FastAPI(title="Chess Coach API", lifespan=lifespan)
app.include_router(router, prefix="/api")

# Mounted last so /api routes take priority. The app routes with query strings
# (?room=..., ?mode=3d), so index.html at / is the only page needed.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
