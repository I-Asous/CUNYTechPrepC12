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
    {"id": "penny", "emoji": "🐣", "name": "Penny", "rating": 400, "style": "random",
     "description": "Just hatched! Thinks every piece is a snack."},
    {"id": "ray", "emoji": "🦝", "name": "Rookie Ray", "rating": 800, "style": "sloppy", "lines": 8, "temperature": 150,
     "description": "Rummages for loot and forgets to guard his own stuff."},
    {"id": "cal", "emoji": "🐢", "name": "Casual Cal", "rating": 1100, "style": "sloppy", "lines": 5, "temperature": 60,
     "description": "Slow and steady, with the occasional wobble."},
    {"id": "clara", "emoji": "🦊", "name": "Club Player Clara", "rating": 1500, "style": "limited", "elo": 1500,
     "description": "Sly and solid. Pounces on loose pieces."},
    {"id": "bea", "emoji": "🐛", "name": "Bookworm Bea", "rating": 1800, "style": "book", "elo": 1800,
     "description": "Has memorized every opening book in the library."},
    {"id": "max", "emoji": "🧙", "name": "Master Max", "rating": 2200, "style": "limited", "elo": 2200,
     "description": "Sees five moves ahead. Possibly magic."},
    {"id": "stockfish", "emoji": "🐟", "name": "Stockfish", "rating": 3200, "style": "full",
     "description": "The deep-sea engine at full strength. Good luck down there."},
]
BY_ID = {bot["id"]: bot for bot in BOTS}

PUBLIC_FIELDS = ("id", "name", "emoji", "rating", "description")
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
