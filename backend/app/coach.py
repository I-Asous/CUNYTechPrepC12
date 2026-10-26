"""Coaching logic: turns engine analysis into feedback for the player.

Not implemented yet. Until it is, every endpoint answers 501, and the
frontend shows the coach as offline.
"""

from fastapi import HTTPException


def _not_implemented():
    raise HTTPException(status_code=501, detail="Coach not implemented yet")


def review_move(fen, move):
    """Return {"quality": ..., "message": ...} for `move` played from `fen`."""
    _not_implemented()


def piece_hint(fen, square):
    """Return {"is_best": ..., "message": ...} for the piece on `square`."""
    _not_implemented()


def best_move_hint(fen):
    """Return {"best": <UCI move>, "message": ...} for the position."""
    _not_implemented()


def chat(fen, history, message):
    """Return {"reply": ...} answering the player's question."""
    _not_implemented()
