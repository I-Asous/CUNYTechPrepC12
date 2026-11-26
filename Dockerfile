# One container serves the whole site: FastAPI answers /api (including the
# online games' WebSockets) and serves the built React app for everything else.

# --- Build the frontend ---
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Vite bakes this into the page at build time (sign-in is off without it).
# Render passes the service's environment variables in as build args. It's a
# publishable key, so it's fine for it to end up in the built JavaScript.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# --- Run the backend ---
FROM python:3.13-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*
# Debian installs Stockfish under /usr/games, which isn't on PATH here.
ENV STOCKFISH_PATH=/usr/games/stockfish \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=frontend /frontend/dist /app/frontend/dist

# Hosts like Render pass the port to listen on in $PORT.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
