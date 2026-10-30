"""Coaching logic: turns engine analysis and dataset facts into feedback.

Moves are graded by how much they lower the mover's chance of winning
(the same approach Lichess uses), and explained with the rules in
explain.py plus what the datasets know about the position.
"""

import chess
from fastapi import HTTPException

from app import engine, explain
from app.data import masters, openings, puzzles

# Largest drop in winning chances (percentage points) for each grade.
GRADES = [(2, "best"), (10, "good"), (20, "inaccuracy"), (30, "mistake")]


def _board(fen):
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid FEN")
    if board.is_game_over():
        raise HTTPException(status_code=400, detail="The game is over")
    return board


def _grade(drop, is_engine_best):
    if is_engine_best:
        return "best"
    return next((grade for limit, grade in GRADES if drop < limit), "blunder")


def review_move(fen, move):
    """Return {"quality": ..., "message": ...} for `move` played from `fen`."""
    board = _board(fen)
    try:
        played = chess.Move.from_uci(move)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid move")
    if played not in board.legal_moves:
        raise HTTPException(status_code=400, detail="Illegal move")

    san = board.san(played)
    best = engine.analyse(board)[0]
    line = best if best["move"] == played else engine.analyse(board, moves=[played])[0]
    drop = explain.win_chance(best["score"]) - explain.win_chance(line["score"])
    quality = _grade(drop, best["move"] == played)

    after = board.copy()
    after.push(played)
    parts = []

    if quality in ("best", "good"):
        reasons = explain.move_reasons(board, played)
        opener = "Great move!" if quality == "best" else "Good move."
        parts.append(f"{opener} {san} {explain.join(reasons)}." if reasons else opener)
        if quality == "good":
            parts.append(f"{board.san(best['move'])} was slightly stronger.")
        if openings.in_book(after.fen()):
            opening = openings.name_for([after.fen()])
            parts.append(f"You're still in opening theory{': ' + opening['name'] if opening else ''}.")
    else:
        problems = explain.move_problems(board, played)
        label = {"inaccuracy": "Inaccuracy", "mistake": "Mistake", "blunder": "Blunder"}[quality]
        parts.append(f"{label}: {san} {explain.join(problems)}." if problems else f"{label}: {san} weakens your position.")

        if len(line["pv"]) > 1:
            reply = line["pv"][1]
            reply_reasons = explain.move_reasons(after, reply)
            parts.append(f"Your opponent can answer {after.san(reply)}"
                         + (f", which {explain.join(reply_reasons)}." if reply_reasons else "."))

        best_reasons = explain.move_reasons(board, best["move"])
        parts.append(f"Better was {board.san(best['move'])}"
                     + (f", which {explain.join(best_reasons)}." if best_reasons else "."))

        missed = {theme for p in puzzles.at_position(fen) for theme in p["themes"]} & set(puzzles.TACTIC_THEMES)
        if missed:
            parts.append(f"There was a {explain.join([puzzles.theme_title(t) for t in sorted(missed)])} available here.")
        if openings.in_book(fen) and not openings.in_book(after.fen()):
            parts.append("This also leaves known opening theory.")

    stats = masters.lookup(fen)
    if stats and stats["games"]:
        count = next((m["games"] for m in stats["moves"] if m["uci"] == move), 0)
        if count:
            parts.append(f"Masters have played {san} here in {count:,} of {stats['games']:,} games.")

    return {"quality": quality, "message": " ".join(parts)}


def piece_hint(fen, square):
    """Return {"is_best": ..., "message": ...} for the piece on `square`."""
    board = _board(fen)
    try:
        from_square = chess.parse_square(square)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid square")
    piece = board.piece_at(from_square)
    if not piece or piece.color != board.turn:
        raise HTTPException(status_code=400, detail="No piece of the side to move on that square")

    piece_name = explain.name(piece.piece_type)
    moves = [m for m in board.legal_moves if m.from_square == from_square]
    if not moves:
        return {"is_best": False, "message": f"Your {piece_name} on {square} has no legal moves."}

    best = engine.analyse(board)[0]
    if best["move"].from_square == from_square:
        return {"is_best": True, "message": f"Good eye: the {piece_name} is the right piece to move."}

    own_best = engine.analyse(board, moves=moves)[0]
    drop = explain.win_chance(best["score"]) - explain.win_chance(own_best["score"])
    best_piece = explain.name(board.piece_type_at(best["move"].from_square))
    if best_piece == piece_name:
        best_piece = f"other {best_piece}"

    if drop < 5:
        message = f"The {piece_name} is a fine choice, but your {best_piece} has a slightly better move."
    else:
        message = f"Moving the {piece_name} isn't best here. Take a look at your {best_piece}."
    in_danger = [s for s in explain.hanging(board, board.turn) if s != from_square]
    if in_danger and best["move"].from_square in in_danger:
        message += f" It's under attack on {chess.square_name(best['move'].from_square)}."
    return {"is_best": False, "message": message}


def best_move_hint(fen):
    """Return {"best": <UCI move>, "message": ...} for the position."""
    board = _board(fen)
    best = chess.Move.from_uci(engine.best_move(fen))
    reasons = explain.move_reasons(board, best)
    message = f"The best move is {board.san(best)}"
    message += f". It {explain.join(reasons)}." if reasons else "."
    return {"best": best.uci(), "message": message}
