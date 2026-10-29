"""Gathers what the datasets know about a position or move.

The coach uses these facts to grade moves and the chatbot gets them as
context, so its explanations come from real data instead of guesses.
Any source that has nothing on a position is simply left out (None or []).
"""

import chess

from app.data import evals, masters, openings, puzzles


def _positions(history_san):
    """FEN of every position in a game given its moves in SAN, starting position first."""
    board = chess.Board()
    fens = [board.fen()]
    for san in history_san:
        board.push_san(san)
        fens.append(board.fen())
    return fens


def _tactics(fen):
    found = puzzles.at_position(fen)
    themes = sorted({theme for puzzle in found for theme in puzzle["themes"]})
    return [{"theme": theme, **(puzzles.describe_theme(theme) or {})} for theme in themes]


def position_facts(fen, history_san=None):
    """Everything known about `fen`. Pass the game's SAN moves to name the opening."""
    fens = _positions(history_san) if history_san else [fen]
    return {
        "opening": openings.name_for(fens),
        "in_book": openings.in_book(fen),
        "eval": evals.lookup(fen),
        "masters": masters.lookup(fen),
        "tactics": _tactics(fen),  # tactics available to the side to move
    }


def move_facts(fen, move_uci):
    """What the datasets say about playing `move_uci` from `fen`."""
    board = chess.Board(fen)
    move = chess.Move.from_uci(move_uci)
    san = board.san(move)
    board.push(move)

    before = evals.lookup(fen)
    master_stats = masters.lookup(fen)
    masters_played = None
    if master_stats:
        masters_played = next((m["games"] for m in master_stats["moves"] if m["uci"] == move_uci), 0)

    return {
        "move": san,
        "stays_in_book": openings.in_book(board.fen()),
        "opening_after": openings.name_for([board.fen()]),
        "eval_before": before,
        "eval_after": evals.lookup(board.fen()),
        "engine_best": before["lines"][0]["line"].split()[0] if before else None,
        "masters_total": master_stats["games"] if master_stats else None,
        "masters_played": masters_played,
        "allows_tactic": _tactics(board.fen()),  # opponent now has these tactics
    }
