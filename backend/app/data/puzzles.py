"""Tactics from the Lichess puzzle database (database.lichess.org).

Each puzzle row's FEN is the position *before* the opponent's move; the
first UCI move in `Moves` is that move, and the rest are the solution.
We store the puzzle under the position after that first move, which is the
one the solver faces.

Theme names and plain-language descriptions come from Lichess's own
translation file.
"""

import csv
import io
import re
import urllib.request
from html import unescape

import chess
import zstandard

from app.data.store import RAW_DIR, position_key, query

SOURCE = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
THEMES_SOURCE = "https://raw.githubusercontent.com/lichess-org/lila/master/translation/source/puzzleTheme.xml"
RAW_FILE = RAW_DIR / "lichess_db_puzzle.csv.zst"

# Themes that name an actual tactic, as opposed to tags like "middlegame" or "short".
TACTIC_THEMES = [
    "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece", "trappedPiece",
    "sacrifice", "deflection", "attraction", "interference", "xRayAttack", "clearance",
    "capturingDefender", "intermezzo", "quietMove", "backRankMate", "smotheredMate",
    "mateIn1", "mateIn2", "mateIn3", "promotion", "underPromotion", "zugzwang",
]


def download():
    if not RAW_FILE.exists():
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        partial = RAW_FILE.with_suffix(".part")
        urllib.request.urlretrieve(SOURCE, partial)
        partial.rename(RAW_FILE)


def _build_themes(conn):
    with urllib.request.urlopen(THEMES_SOURCE) as response:
        xml = response.read().decode("utf-8")
    strings = {name: unescape(text) for name, text in re.findall(r'<string name="(\w+)">(.*?)</string>', xml)}

    def description(name):
        # Most are "<theme>Description", but a few were renamed later,
        # e.g. "forkOpposingPiecesDescription".
        if name + "Description" in strings:
            return strings[name + "Description"]
        return next((text for key, text in strings.items()
                     if key.startswith(name) and key.endswith("Description")
                     and key.removesuffix("Description") not in strings), None)

    themes = [(name, title, description(name))
              for name, title in strings.items() if not name.endswith("Description")]

    conn.execute("DROP TABLE IF EXISTS themes")
    conn.execute("CREATE TABLE themes (theme TEXT PRIMARY KEY, title TEXT, description TEXT)")
    conn.executemany("INSERT INTO themes VALUES (?, ?, ?)", themes)


def build(conn, min_popularity=80, min_plays=1000):
    """Load puzzles that players rated well and played often enough to trust."""
    download()
    _build_themes(conn)

    conn.execute("DROP TABLE IF EXISTS puzzles")
    conn.execute("DROP TABLE IF EXISTS puzzle_themes")
    conn.execute("""CREATE TABLE puzzles (
        id TEXT PRIMARY KEY, position TEXT, fen TEXT, solution TEXT,
        rating INTEGER, popularity INTEGER, themes TEXT, opening TEXT, url TEXT)""")
    conn.execute("CREATE TABLE puzzle_themes (theme TEXT, rating INTEGER, puzzle_id TEXT)")

    count = 0
    with open(RAW_FILE, "rb") as raw:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(raw), encoding="utf-8")
        for row in csv.DictReader(text):
            if int(row["Popularity"]) < min_popularity or int(row["NbPlays"]) < min_plays:
                continue
            board = chess.Board(row["FEN"])
            opponent_move, *solution = row["Moves"].split()
            board.push_uci(opponent_move)
            rating = int(row["Rating"])
            conn.execute("INSERT INTO puzzles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (
                row["PuzzleId"], position_key(board), board.fen(), " ".join(solution),
                rating, int(row["Popularity"]), row["Themes"], row["OpeningTags"], row["GameUrl"]))
            conn.executemany("INSERT INTO puzzle_themes VALUES (?, ?, ?)",
                             [(theme, rating, row["PuzzleId"]) for theme in row["Themes"].split()])
            count += 1

    conn.execute("CREATE INDEX puzzles_position ON puzzles (position)")
    conn.execute("CREATE INDEX puzzle_themes_lookup ON puzzle_themes (theme, rating)")
    conn.commit()
    return count


def _as_dict(row):
    puzzle_id, fen, solution, rating, themes, url = row
    return {"id": puzzle_id, "fen": fen, "solution": solution.split(),
            "rating": rating, "themes": themes.split(), "url": url}


def at_position(fen):
    """Puzzles that start from exactly this position (the side to move has a tactic)."""
    rows = query("SELECT id, fen, solution, rating, themes, url FROM puzzles WHERE position = ?",
                 (position_key(fen),))
    return [_as_dict(row) for row in rows]


def examples(theme, rating=1500, limit=3):
    """Popular puzzles showing `theme`, near the given rating."""
    rows = query("""
        SELECT p.id, p.fen, p.solution, p.rating, p.themes, p.url
        FROM puzzle_themes t JOIN puzzles p ON p.id = t.puzzle_id
        WHERE t.theme = ? AND t.rating BETWEEN ? AND ?
        ORDER BY p.popularity DESC LIMIT ?""", (theme, rating - 200, rating + 200, limit))
    return [_as_dict(row) for row in rows]


def describe_theme(theme):
    """{"title": ..., "description": ...} for a theme tag like "fork", or None."""
    rows = query("SELECT title, description FROM themes WHERE theme = ?", (theme,))
    return {"title": rows[0][0], "description": rows[0][1]} if rows else None


def theme_title(theme):
    """Readable lowercase name for a theme tag: "discoveredAttack" -> "discovered attack"."""
    described = describe_theme(theme)
    return described["title"].lower() if described else re.sub(r"(?<!^)([A-Z])", r" \1", theme).lower()
