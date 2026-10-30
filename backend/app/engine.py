"""Position analysis: finding and scoring moves with Stockfish.

Stockfish runs as one shared subprocess. Set STOCKFISH_PATH if it isn't on
your PATH (on macOS: `brew install stockfish`).

Scores are in centipawns from the point of view of the side to move in the
analysed position, unless a function says otherwise. Mates count as
+/-10000 so they compare like any other score.
"""

import os
import shutil
import threading

import chess
import chess.engine

from app.data import evals

THINK_TIME = 0.2   # seconds per analysis
MATE_SCORE = 10000

_engine = None
_lock = threading.Lock()


def _get_engine():
    global _engine
    if _engine is None:
        path = os.environ.get("STOCKFISH_PATH") or shutil.which("stockfish")
        if not path:
            raise RuntimeError("Stockfish not found. Install it or set STOCKFISH_PATH.")
        _engine = chess.engine.SimpleEngine.popen_uci(path)
    return _engine


def close():
    global _engine
    if _engine is not None:
        _engine.quit()
        _engine = None


def analyse(board, lines=1, moves=None):
    """Top `lines` moves for the side to move, best first.

    Pass `moves` to only consider those moves. Returns a list of
    {"move": chess.Move, "score": centipawns, "pv": [chess.Move, ...]}.
    """
    with _lock:
        infos = _get_engine().analyse(board, chess.engine.Limit(time=THINK_TIME),
                                      multipv=lines, root_moves=moves)
    return [{"move": info["pv"][0],
             "score": info["score"].pov(board.turn).score(mate_score=MATE_SCORE),
             "pv": info["pv"]}
            for info in infos if info.get("pv")]


def play(board, elo=None, think_time=THINK_TIME):
    """The engine's move, optionally playing at roughly `elo` strength (1320-3190)."""
    options = {"UCI_LimitStrength": True, "UCI_Elo": elo} if elo else {}
    with _lock:
        return _get_engine().play(board, chess.engine.Limit(time=think_time), options=options).move


def best_move(fen):
    """Return the best move in UCI notation for the position.

    Uses the precomputed evaluations database when it has the position,
    since those were searched much deeper than we can afford per request.
    """
    known = evals.lookup(fen)
    if known:
        return known["lines"][0]["line"].split()[0]
    return analyse(chess.Board(fen))[0]["move"].uci()


def evaluate(fen):
    """Return a score for the position from white's point of view."""
    board = chess.Board(fen)
    score = analyse(board)[0]["score"]
    return score if board.turn == chess.WHITE else -score
