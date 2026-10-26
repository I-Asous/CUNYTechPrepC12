"""Request and response shapes for the API.

These mirror what frontend/src/api.js sends and expects back.
Positions are FEN strings and moves are UCI ("e2e4", "e7e8q").
"""

from typing import Literal

from pydantic import BaseModel

MoveQuality = Literal["best", "good", "inaccuracy", "mistake", "blunder"]


class ReviewRequest(BaseModel):
    fen: str   # position before the move
    move: str  # UCI


class ReviewResponse(BaseModel):
    quality: MoveQuality
    message: str


class PieceHintRequest(BaseModel):
    fen: str
    square: str  # e.g. "g1"


class PieceHintResponse(BaseModel):
    is_best: bool
    message: str


class HintRequest(BaseModel):
    fen: str


class HintResponse(BaseModel):
    best: str  # UCI
    message: str


class ChatRequest(BaseModel):
    fen: str
    history: list[str]  # the game's moves so far, in SAN ("e4", "Nf3")
    message: str


class ChatResponse(BaseModel):
    reply: str
