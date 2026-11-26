"""Shared SQLite storage for the datasets.

Positions are keyed by the first four FEN fields (pieces, turn, castling,
en passant) as python-chess writes them, so the same position matches no
matter which dataset or move counters it came from.
"""

import sqlite3
from pathlib import Path

import chess

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "chess_data.sqlite"


def position_key(position):
    """Key for a FEN string or chess.Board."""
    board = position if isinstance(position, chess.Board) else chess.Board(position)
    return board.epd()


def connect():
    DATA_DIR.mkdir(exist_ok=True)
    return sqlite3.connect(DB_PATH)


def query(sql, params=()):
    """Run a read query; returns [] if the database or table isn't built yet."""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        return conn.execute(sql, params).fetchall()
    except sqlite3.OperationalError as error:
        if "no such table" in str(error):
            return []
        raise
    finally:
        conn.close()
