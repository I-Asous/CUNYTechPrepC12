"""Rule-based chat: answers the player's questions without calling an LLM.

Each question is matched to a topic by keywords, and the answer is built
from the engine, the explanation rules and the datasets. "You" always
means the side to move, since the player controls both colors.
"""

import re

import chess

from app import coach, engine, explain
from app.data import masters, openings, puzzles
from app.data.puzzles import TACTIC_THEMES, theme_title

HELP = ("You can ask me things like: \"What's the best move?\", \"Was my last move good?\", "
        "\"Who's winning?\", \"What opening is this?\", \"What is my opponent threatening?\", "
        "\"Are there any tactics?\", \"What's the plan?\", \"What do masters play here?\" "
        "or \"What is a fork?\"")


def _mentioned_theme(text):
    """A tactic theme named in the question ("pin", "discovered attack"), or None."""
    for theme in TACTIC_THEMES:
        if theme_title(theme) in text or theme.lower() in text.replace(" ", ""):
            return theme
    return None


def _positions(history):
    """Boards for each position in the game, or None if the history doesn't replay."""
    board = chess.Board()
    boards = [board.copy()]
    try:
        for san in history:
            board.push_san(san)
            boards.append(board.copy())
    except ValueError:
        return None
    return boards


def _side(board):
    return "White" if board.turn == chess.WHITE else "Black"


# Topics: each answers a question about the current position.

def _best_move(board, history):
    if board.is_game_over():
        return "The game is over, so there's no move to find."
    return coach.best_move_hint(board.fen())["message"]


def _last_move(board, history):
    boards = _positions(history)
    if not boards or len(boards) < 2:
        return "No moves have been played yet. Make a move and I'll review it."
    before = boards[-2]
    move = before.parse_san(history[-1])
    return coach.review_move(before.fen(), move.uci())["message"]


def _evaluation(board, history):
    if board.is_checkmate():
        return f"It's checkmate. {'Black' if board.turn == chess.WHITE else 'White'} won."
    if board.is_game_over():
        return "The game is a draw."
    cp = engine.evaluate(board.fen())
    shown = f" ({cp / 100:+.1f})" if abs(cp) < 9000 else ""
    return f"{explain.describe_eval(cp)}{shown}. It's {_side(board)} to move."


def _opening(board, history):
    boards = _positions(history) or [board]
    opening = openings.name_for([b.fen() for b in boards])
    if not opening:
        return ("This doesn't match a named opening yet." if len(boards) < 3
                else "I don't recognize an opening name for this game.")
    answer = f"This is the {opening['name']} ({opening['eco']})."
    answer += (" You're still in known theory." if openings.in_book(board.fen())
               else " The game has since left known theory.")
    return answer


def _masters(board, history):
    stats = masters.lookup(board.fen())
    if stats is None:
        return "I can't reach the masters database right now (it needs a LICHESS_TOKEN on the server)."
    if not stats["games"]:
        return "No master games have reached this position."
    top = [f"{m['san']} ({m['games'] / stats['games']:.0%})" for m in stats["moves"][:3]]
    return f"This position appears in {stats['games']:,} master games. Most played: {explain.join(top)}."


def _threats(board, history):
    if board.is_game_over():
        return "The game is over."
    parts = []
    in_danger = explain.hanging(board, board.turn)
    if in_danger:
        pieces = [f"{explain.name(board.piece_type_at(s))} on {chess.square_name(s)}" for s in in_danger]
        parts.append(f"Your {explain.join(pieces)} {'is' if len(pieces) == 1 else 'are'} under attack.")
    if board.is_check():
        parts.insert(0, "You're in check, so you have to deal with that first.")
    else:
        # Let the opponent move twice in a row to see what they want to do.
        # Rebuilt from FEN because the engine can't be sent a null move.
        passed = board.copy()
        passed.push(chess.Move.null())
        passed = chess.Board(passed.fen())
        if not passed.is_game_over():
            threat = engine.analyse(passed)[0]["move"]
            reasons = explain.move_reasons(passed, threat)
            if any(r.startswith(("wins", "forks", "attacks the queen", "delivers", "gives check")) for r in reasons):
                parts.append(f"Your opponent is threatening {passed.san(threat)}, which {explain.join(reasons)}.")
    return " ".join(parts) or "Nothing urgent: your opponent has no immediate threat."


def _tactics(board, history, theme=None):
    if theme:
        described = puzzles.describe_theme(theme)
        answer = (f"A {described['title'].lower()}: {described['description']}" if described and described["description"]
                  else f"That's a {theme_title(theme)}.")
        example = puzzles.examples(theme, limit=1)
        if example:
            answer += f" Here's an example to try: {example[0]['url']}"
        return answer

    found = sorted({t for p in puzzles.at_position(board.fen()) for t in p["themes"]} & set(TACTIC_THEMES))
    if found:
        return f"Yes! There's a {explain.join([theme_title(t) for t in found])} here. Can you find it?"
    if board.is_game_over():
        return "The game is over."
    best = engine.analyse(board)[0]["move"]
    reasons = explain.move_reasons(board, best)
    tactical = [r for r in reasons if r.startswith(("wins", "forks", "delivers"))]
    if tactical:
        return f"Yes: there's a move that {tactical[0].split(' on ')[0]}. Look for it!"
    return "No immediate tactic here. Focus on improving your position."


def _plan(board, history):
    if board.is_game_over():
        return "The game is over."
    color = board.turn
    advice = []
    pieces = len(board.piece_map())
    home = {chess.WHITE: [chess.B1, chess.G1, chess.C1, chess.F1], chess.BLACK: [chess.B8, chess.G8, chess.C8, chess.F8]}[color]
    undeveloped = [s for s in home if board.piece_type_at(s) in (chess.KNIGHT, chess.BISHOP)
                   and board.color_at(s) == color]
    king = board.king(color)
    castled = king in ([chess.G1, chess.C1, chess.B1, chess.H1] if color == chess.WHITE
                       else [chess.G8, chess.C8, chess.B8, chess.H8])

    if pieces > 24:
        if undeveloped:
            advice.append(f"develop your remaining {'pieces' if len(undeveloped) > 1 else 'piece'} "
                          f"({explain.join([explain.name(board.piece_type_at(s)) for s in undeveloped])})")
        if not castled and board.has_castling_rights(color):
            advice.append("castle to get your king safe")
        advice.append("keep control of the center")
    elif pieces <= 12:
        advice.append("bring your king toward the center; it's a strong piece in the endgame")
        advice.append("push passed pawns and stop your opponent's")
    else:
        advice.append("find your least active piece and improve it")
        advice.append("look for weaknesses in your opponent's position, like loose pieces or an exposed king")

    preview = board.copy()
    ideas = []
    for i, move in enumerate(engine.analyse(board)[0]["pv"][:5]):
        if i % 2 == 0:  # your moves only
            ideas.append(preview.san(move))
        preview.push(move)

    answer = f"As {_side(board)}, {explain.join(advice)}."
    if ideas:
        answer += f" The engine's main line for you: {', '.join(ideas)}."
    return answer


TOPICS = [
    (r"\b(hi|hello|hey)\b", lambda b, h: "Hi! " + HELP),
    (r"\b(help|what can you)\b", lambda b, h: HELP),
    (r"\b(threat|threaten\w*|danger|hanging|undefended|attacking me|under attack)\b", _threats),
    (r"\b(last move|my move|that move|was (it|that|this)|review|mistake|blunder)\b", _last_move),
    (r"\b(masters?|grandmasters?|gms?|pros?|strong players)\b", _masters),
    (r"\b(opening|theory|book|eco)\b", _opening),
    (r"\b(tactics?|combination|trick)\b", _tactics),
    (r"\b(plan|strategy|ideas?|focus|advice|what now)\b", _plan),
    (r"\b(best move|what should i|what do i|hint|suggest\w*|recommend\w*|next move|which move)\b", _best_move),
    (r"\b(winning|losing|who.?s better|eval\w*|score|advantage|ahead|behind)\b", _evaluation),
]


def reply(fen, history, message):
    try:
        board = chess.Board(fen)
    except ValueError:
        return "I couldn't read the current position."
    text = message.lower()

    theme = _mentioned_theme(text)
    if theme and not re.search(r"\b(threat|my move|last move)\b", text):
        return _tactics(board, history, theme)
    for pattern, topic in TOPICS:
        if re.search(pattern, text):
            return topic(board, history)
    return "I'm not sure what you mean. " + HELP
