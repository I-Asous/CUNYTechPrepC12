"""Computer opponents to practice against, from beginner to full strength.

Stockfish can't play weaker than about 1320 Elo on its own, so the three
weakest bots pick from Stockfish's top moves at random, favouring the
better ones by an amount set by their "temperature" (in centipawns; higher
means sloppier). The stronger bots use Stockfish's own strength limit.
Ratings are rough estimates.
"""

import math
import random

import chess
from fastapi import HTTPException

from app import engine
from app.data import openings

BOTS = [
    {"id": "grub", "name": "Grub the Goblin", "rating": 400, "style": "random",
     "description": "Grabs anything shiny. Still not sure how the horsey moves."},
    {"id": "pip", "name": "Pip the Squire", "rating": 800, "style": "sloppy", "lines": 8, "temperature": 150,
     "description": "A knight in training. Charges at anything in reach and forgets to guard the rest."},
    {"id": "barnaby", "name": "Barnaby the Bard", "rating": 1100, "style": "sloppy", "lines": 5, "temperature": 60,
     "description": "Plays between songs. Usually picks a good move, sometimes just a catchy one."},
    {"id": "elowen", "name": "Elowen the Elf", "rating": 1500, "style": "limited", "elo": 1500,
     "description": "A sharp-eyed archer. Spots a loose piece from across the board."},
    {"id": "ambrose", "name": "Ambrose the Monk", "rating": 1800, "style": "book", "elo": 1800,
     "description": "Has copied out every opening book in the monastery library."},
    {"id": "morwen", "name": "Morwen the Sorceress", "rating": 2200, "style": "limited", "elo": 2200,
     "description": "Sees five moves ahead in a crystal ball."},
    {"id": "ignis", "name": "Ignis the Dragon", "rating": 3200, "style": "full",
     "description": "Full-strength Stockfish. Hoards wins like gold. Good luck."},
]
BY_ID = {bot["id"]: bot for bot in BOTS}

PUBLIC_FIELDS = ("id", "name", "rating", "description")
BOOK_TOLERANCE = 25  # centipawns: book moves this close to the best are fair game


def list_bots():
    return [{field: bot[field] for field in PUBLIC_FIELDS} for bot in BOTS]


def _random_move(board):
    moves = list(board.legal_moves)
    captures = [m for m in moves if board.is_capture(m)]
    if captures and random.random() < 0.7:
        return random.choice(captures)
    return random.choice(moves)


def _sloppy_move(board, lines, temperature):
    candidates = engine.analyse(board, lines=lines)
    best = candidates[0]["score"]
    weights = [math.exp((c["score"] - best) / temperature) for c in candidates]
    return random.choices([c["move"] for c in candidates], weights)[0]


def _book_move(board):
    """A sound move that stays in opening theory, or None once out of book."""
    book = []
    for move in board.legal_moves:
        board.push(move)
        if openings.in_book(board.fen()):
            book.append(move)
        board.pop()
    if not book:
        return None
    scored = engine.analyse(board, lines=len(book), moves=book)
    top = scored[0]["score"]
    return random.choice([s["move"] for s in scored if s["score"] >= top - BOOK_TOLERANCE])


def choose_move(fen, bot_id):
    """Return the bot's move in UCI notation."""
    bot = BY_ID.get(bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Unknown bot")
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid FEN")
    if board.is_game_over():
        raise HTTPException(status_code=400, detail="The game is over")

    style = bot["style"]
    if style == "random":
        move = _random_move(board)
    elif style == "sloppy":
        move = _sloppy_move(board, bot["lines"], bot["temperature"])
    elif style == "book":
        move = _book_move(board) or engine.play(board, elo=bot["elo"])
    elif style == "limited":
        move = engine.play(board, elo=bot["elo"])
    else:
        move = engine.play(board, think_time=1.0)
    return move.uci()
