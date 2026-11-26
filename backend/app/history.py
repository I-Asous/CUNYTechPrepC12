"""Saving and listing signed-in players' finished games.

The browser only sends the moves. The server replays them to check they're
legal and works out the result itself, so a player can't save a win they
didn't earn by editing the request.
"""

from datetime import date

import chess
import chess.pgn
from sqlalchemy import func, insert, select

from app import bots, db
from app.rooms import TERMINATIONS

MAX_PLIES = 1000  # far beyond any real game, just a limit on request size


class GameError(ValueError):
    """The submitted game can't be saved (bad moves, not finished, ...)."""


class NotConfigured(RuntimeError):
    """DATABASE_URL isn't set."""


def _engine():
    engine = db.get_engine()
    if engine is None:
        raise NotConfigured("Saving games isn't set up on this server (DATABASE_URL is missing).")
    return engine


def _replay(moves):
    board = chess.Board()
    for number, uci in enumerate(moves, start=1):
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            raise GameError(f"Move {number} ({uci!r}) isn't a UCI move.")
        if move not in board.legal_moves:
            raise GameError(f"Move {number} ({uci}) isn't legal in that position.")
        board.push(move)
    return board


def _pgn(board, bot_name, color, result):
    game = chess.pgn.Game.from_board(board)
    game.headers["Event"] = "Chess Coach practice game"
    game.headers["Site"] = "Chess Coach"
    game.headers["Date"] = date.today().strftime("%Y.%m.%d")
    game.headers["White"] = "Player" if color == "w" else bot_name
    game.headers["Black"] = bot_name if color == "w" else "Player"
    game.headers["Result"] = result
    return str(game)


def _row_to_dict(row):
    return {
        "id": row.id,
        "kind": row.kind,
        "opponent": row.opponent,
        "color": row.color,
        "result": row.result,
        "reason": row.reason,
        "plies": row.plies,
        "pgn": row.pgn,
        "played_at": row.played_at,
    }


def save_bot_game(user_id, bot_id, color, moves):
    """Replay and save a finished game against a bot. Returns the saved game."""
    bot = bots.BY_ID.get(bot_id)
    if bot is None:
        raise GameError(f"There's no bot called {bot_id!r}.")
    if len(moves) > MAX_PLIES:
        raise GameError("That game is too long to save.")

    board = _replay(moves)
    outcome = board.outcome(claim_draw=True)  # also ends on threefold repetition and the 50-move rule, like the board
    if outcome is None:
        raise GameError("The game isn't over yet.")

    if outcome.winner is None:
        result = "draw"
    else:
        result = "win" if outcome.winner == (color == "w") else "loss"

    values = {
        "user_id": user_id,
        "kind": "bot",
        "opponent": bot_id,
        "color": color,
        "result": result,
        "reason": TERMINATIONS.get(outcome.termination, "draw"),
        "plies": len(moves),
        "pgn": _pgn(board, bot["name"], color, outcome.result()),
    }
    with _engine().begin() as conn:
        row = conn.execute(insert(db.games).values(**values).returning(*db.games.c)).one()
    return _row_to_dict(row)


def list_games(user_id, limit=20):
    """The player's most recent games, newest first."""
    query = (select(db.games).where(db.games.c.user_id == user_id)
             .order_by(db.games.c.played_at.desc(), db.games.c.id.desc()).limit(limit))
    with _engine().connect() as conn:
        return [_row_to_dict(row) for row in conn.execute(query)]


def count_games(user_id):
    """How many games the player has saved, or None if saving isn't set up."""
    if not db.configured():
        return None
    query = select(func.count()).select_from(db.games).where(db.games.c.user_id == user_id)
    with _engine().connect() as conn:
        return conn.execute(query).scalar_one()
