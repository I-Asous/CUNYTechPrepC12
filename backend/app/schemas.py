"""Request and response shapes for the API.

These mirror what frontend/src/api.js sends and expects back.
Positions are FEN strings and moves are UCI ("e2e4", "e7e8q").
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

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


class Bot(BaseModel):
    id: str
    name: str
    rating: int  # rough estimate
    description: str


class BotMoveRequest(BaseModel):
    fen: str
    bot: str  # Bot.id


class BotMoveResponse(BaseModel):
    move: str  # UCI


class CreateRoomRequest(BaseModel):
    color: Literal["w", "b", "random"] = "random"  # the creator's color


class CreateRoomResponse(BaseModel):
    code: str


class MeResponse(BaseModel):
    user_id: str             # Clerk user ID
    games_saved: int | None  # None if saving games isn't set up on the server


class SaveGameRequest(BaseModel):
    bot: str                   # Bot.id
    color: Literal["w", "b"]   # the player's color
    moves: list[str] = Field(max_length=1000)  # every move of the game from the start, in UCI


class SavedGame(BaseModel):
    id: int
    kind: Literal["bot"]
    opponent: str                            # Bot.id
    color: Literal["w", "b"]                 # the player's color
    result: Literal["win", "loss", "draw"]   # from the player's side
    reason: str                              # "checkmate", "stalemate", ...
    plies: int                               # half-moves played
    pgn: str
    played_at: datetime
