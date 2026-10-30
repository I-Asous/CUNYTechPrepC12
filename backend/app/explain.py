"""Plain-language descriptions of moves and positions, from the board alone.

These are rules of thumb (hanging pieces, threats, development, center
control) rather than engine output, so the coach can say *why* a move is
good or bad and not just that it is.
"""

import math

import chess

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
CENTER = [chess.D4, chess.E4, chess.D5, chess.E5]


def name(piece_type):
    return chess.piece_name(piece_type)


def join(phrases):
    """["a", "b", "c"] -> "a, b and c"."""
    if len(phrases) <= 1:
        return "".join(phrases)
    return ", ".join(phrases[:-1]) + " and " + phrases[-1]


def win_chance(cp):
    """Centipawns -> chance of winning (0-100), the curve Lichess uses for move grading."""
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def describe_eval(cp_white):
    """Score from white's point of view -> "White is clearly better" etc."""
    if abs(cp_white) >= 9000:
        return f"{'White' if cp_white > 0 else 'Black'} has a forced checkmate"
    side = "White" if cp_white > 0 else "Black"
    size = abs(cp_white)
    if size < 30:
        return "The position is about equal"
    if size < 100:
        return f"{side} is slightly better"
    if size < 300:
        return f"{side} is clearly better"
    return f"{side} is winning"


def hanging(board, color):
    """Squares of `color`'s pieces that the opponent can win: undefended, or attacked by something cheaper."""
    result = []
    for square, piece in board.piece_map().items():
        if piece.color != color or piece.piece_type == chess.KING:
            continue
        attackers = board.attackers(not color, square)
        if not attackers:
            continue
        cheapest = min(VALUES[board.piece_type_at(a)] for a in attackers)
        if not board.attackers(color, square) or cheapest < VALUES[piece.piece_type]:
            result.append(square)
    return result


def _threats(board, square):
    """Opponent pieces the piece on `square` now attacks and could win."""
    piece = board.piece_at(square)
    targets = []
    for target in board.attacks(square):
        victim = board.piece_at(target)
        if not victim or victim.color == piece.color:
            continue
        if victim.piece_type == chess.KING:
            continue
        if VALUES[victim.piece_type] > VALUES[piece.piece_type] or not board.attackers(victim.color, target):
            targets.append(target)
    return targets


def move_reasons(board, move):
    """What `move` accomplishes, as short phrases. `board` is the position before the move."""
    reasons = []
    mover = board.turn
    piece = board.piece_at(move.from_square)
    hanging_before = set(hanging(board, mover))

    if board.is_castling(move):
        reasons.append("castles, getting the king to safety")
    elif board.is_capture(move):
        captured = chess.PAWN if board.is_en_passant(move) else board.piece_type_at(move.to_square)
        reasons.append(f"wins the {name(captured)} on {chess.square_name(move.to_square)}")
    if move.promotion:
        reasons.append(f"promotes to a {name(move.promotion)}")

    after = board.copy()
    after.push(move)
    if after.is_checkmate():
        return ["delivers checkmate"]
    if after.is_check():
        reasons.append("gives check")

    threats = _threats(after, move.to_square)
    if len(threats) >= 2:
        reasons.append("forks the " + join([f"{name(after.piece_type_at(t))} on {chess.square_name(t)}" for t in threats]))
    elif threats:
        reasons.append(f"attacks the {name(after.piece_type_at(threats[0]))} on {chess.square_name(threats[0])}")

    if move.from_square in hanging_before and move.to_square not in hanging(after, mover):
        reasons.append(f"moves the {name(piece.piece_type)} out of danger")
    saved = [f"{name(after.piece_type_at(s))} on {chess.square_name(s)}"
             for s in hanging_before - {move.from_square} - set(hanging(after, mover)) if after.piece_at(s)]
    if saved:
        reasons.append("protects the " + join(saved))

    back_rank = chess.BB_RANK_1 if mover == chess.WHITE else chess.BB_RANK_8
    if (piece.piece_type in (chess.KNIGHT, chess.BISHOP) and board.fullmove_number <= 12
            and chess.BB_SQUARES[move.from_square] & back_rank):
        reasons.append(f"develops the {name(piece.piece_type)}")
    if move.to_square in CENTER or any(sq in CENTER for sq in after.attacks(move.to_square)):
        if not reasons or piece.piece_type == chess.PAWN:
            reasons.append("fights for the center")

    return reasons


def move_problems(board, move):
    """What `move` gives away, as short phrases. `board` is the position before the move."""
    problems = []
    mover = board.turn
    piece = board.piece_at(move.from_square)
    after = board.copy()
    after.push(move)

    newly_hanging = set(hanging(after, mover)) - set(hanging(board, mover))
    for square in sorted(newly_hanging, key=lambda s: -VALUES[after.piece_type_at(s)]):
        defended = bool(after.attackers(mover, square))
        what = f"your {name(after.piece_type_at(square))} on {chess.square_name(square)}"
        problems.append(f"leaves {what} where it can be won" if defended else f"leaves {what} undefended")

    if (piece.piece_type == chess.KING and not board.is_castling(move)
            and board.has_castling_rights(mover) and board.fullmove_number <= 15):
        problems.append("gives up the right to castle")

    return problems
