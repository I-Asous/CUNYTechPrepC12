"""The database that keeps signed-in players' games.

Set DATABASE_URL to a Postgres connection string (e.g. from Neon). For local
testing, a SQLite file works too: DATABASE_URL=sqlite:///data/app.sqlite
Without it the site still runs, but games aren't saved.

Tables are created on first use, so there's no separate setup step.
"""

import os
import threading

from sqlalchemy import (Column, DateTime, Integer, MetaData, String, Table, Text,
                        create_engine, func)

metadata = MetaData()

games = Table(
    "games", metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", String(64), nullable=False, index=True),  # Clerk user ID
    Column("kind", String(16), nullable=False),       # "bot" (later also "online" and "3d")
    Column("opponent", String(64), nullable=False),   # bot ID
    Column("color", String(1), nullable=False),       # the player's color: "w" or "b"
    Column("result", String(8), nullable=False),      # the player's result: "win", "loss" or "draw"
    Column("reason", String(32), nullable=False),     # "checkmate", "stalemate", ...
    Column("plies", Integer, nullable=False),         # half-moves played
    Column("pgn", Text, nullable=False),
    Column("played_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

_engine = None
_lock = threading.Lock()


def _url():
    url = os.environ.get("DATABASE_URL", "").strip()
    # Hosts hand out postgres:// or postgresql:// URLs; SQLAlchemy needs to be
    # told to use the psycopg (v3) driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def configured():
    return bool(_url())


def get_engine():
    """The shared engine, creating it and the tables on first use. None if DATABASE_URL isn't set."""
    global _engine
    if _engine is None and configured():
        with _lock:
            if _engine is None:
                # pre_ping replaces connections the host closed while idle
                # (Neon suspends idle databases).
                engine = create_engine(_url(), pool_pre_ping=True)
                metadata.create_all(engine)
                _engine = engine
    return _engine


def close():
    if _engine is not None:
        _engine.dispose()
