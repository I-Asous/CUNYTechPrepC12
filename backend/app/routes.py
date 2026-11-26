"""HTTP endpoints. Each one hands its work to the coach, chatbot or bots module."""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket

from app import bots, chatbot, coach, history, rooms
from app.auth import current_user
from app.schemas import (
    Bot,
    BotMoveRequest,
    BotMoveResponse,
    ChatRequest,
    ChatResponse,
    CreateRoomRequest,
    CreateRoomResponse,
    HintRequest,
    HintResponse,
    MeResponse,
    PieceHintRequest,
    PieceHintResponse,
    ReviewRequest,
    ReviewResponse,
    SavedGame,
    SaveGameRequest,
)

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def me(user_id: str = Depends(current_user)):
    """The signed-in player. Useful for checking that sign-in works end to end."""
    return {"user_id": user_id, "games_saved": history.count_games(user_id)}


@router.post("/games", response_model=SavedGame)
def save_game(request: SaveGameRequest, user_id: str = Depends(current_user)):
    """Save a finished game against a bot to the player's match history."""
    try:
        return history.save_bot_game(user_id, request.bot, request.color, request.moves)
    except history.GameError as error:
        raise HTTPException(400, str(error))
    except history.NotConfigured as error:
        raise HTTPException(503, str(error))


@router.get("/games", response_model=list[SavedGame])
def list_games(limit: int = Query(20, ge=1, le=100), user_id: str = Depends(current_user)):
    """The player's most recent saved games, newest first."""
    try:
        return history.list_games(user_id, limit)
    except history.NotConfigured as error:
        raise HTTPException(503, str(error))


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


@router.post("/rooms", response_model=CreateRoomResponse)
def create_room(request: CreateRoomRequest):
    """Start an online game against a friend; share the code to invite them."""
    return {"code": rooms.create_room(request.color)}


@router.websocket("/rooms/{code}/ws")
async def room_socket(websocket: WebSocket, code: str, name: str = "", player_id: str = ""):
    """Live connection to an online game: moves, chat and presence."""
    await rooms.handle_socket(websocket, code, name, player_id)
