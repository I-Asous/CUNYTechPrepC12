"""HTTP endpoints. Each one hands its work to the coach, chatbot or bots module."""

from fastapi import APIRouter

from app import bots, chatbot, coach
from app.schemas import (
    Bot,
    BotMoveRequest,
    BotMoveResponse,
    ChatRequest,
    ChatResponse,
    HintRequest,
    HintResponse,
    PieceHintRequest,
    PieceHintResponse,
    ReviewRequest,
    ReviewResponse,
)

router = APIRouter()


@router.post("/review", response_model=ReviewResponse)
def review(request: ReviewRequest):
    """Grade the move the player just made."""
    return coach.review_move(request.fen, request.move)


@router.post("/piece-hint", response_model=PieceHintResponse)
def piece_hint(request: PieceHintRequest):
    """Say whether the selected piece is the right one to move."""
    return coach.piece_hint(request.fen, request.square)


@router.post("/hint", response_model=HintResponse)
def hint(request: HintRequest):
    """Best move in the position and why."""
    return coach.best_move_hint(request.fen)


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """Answer a free-form question about the game."""
    return {"reply": chatbot.reply(request.fen, request.history, request.message)}


@router.get("/bots", response_model=list[Bot])
def list_bots():
    """The opponents the player can choose from, weakest first."""
    return bots.list_bots()


@router.post("/bot-move", response_model=BotMoveResponse)
def bot_move(request: BotMoveRequest):
    """The chosen bot's reply in the position."""
    return {"move": bots.choose_move(request.fen, request.bot)}
