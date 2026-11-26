"""Opening names from github.com/lichess-org/chess-openings.

Every position along each named line is stored, so we can tell both what
the opening is called and whether the game is still "in book".
"""

import csv
import io
import urllib.request

import chess
import chess.pgn

from app.data.store import position_key, query

SOURCE = "https://raw.githubusercontent.com/lichess-org/chess-openings/master/{}.tsv"
VOLUMES = "abcde"


def build(conn):
    lines = []
    for volume in VOLUMES:
        with urllib.request.urlopen(SOURCE.format(volume)) as response:
            text = response.read().decode("utf-8")
        lines.extend(csv.DictReader(io.StringIO(text), delimiter="\t"))

    conn.execute("DROP TABLE IF EXISTS openings")
    conn.execute("CREATE TABLE openings (position TEXT PRIMARY KEY, eco TEXT, name TEXT)")

    named, passed_through = [], set()
    for line in lines:
        game = chess.pgn.read_game(io.StringIO(line["pgn"]))
        board = game.board()
        for move in game.mainline_moves():
            passed_through.add(position_key(board))
            board.push(move)
        named.append((position_key(board), line["eco"], line["name"]))

    # Named positions first, so a position that is both named and on the way
    # to a longer line keeps its name.
    conn.executemany("INSERT OR IGNORE INTO openings VALUES (?, ?, ?)", named)
    conn.executemany("INSERT OR IGNORE INTO openings VALUES (?, NULL, NULL)",
                     [(key,) for key in passed_through])
    conn.commit()
    return len(named)


def in_book(fen):
    """True if the position appears in any named opening line."""
    return bool(query("SELECT 1 FROM openings WHERE position = ?", (position_key(fen),)))


def name_for(fens):
    """Opening of a game, given its positions in order: the most recent named one.

    Returns {"eco": ..., "name": ...} or None.
    """
    for fen in reversed(fens):
        rows = query("SELECT eco, name FROM openings WHERE position = ? AND name IS NOT NULL",
                     (position_key(fen),))
        if rows:
            eco, name = rows[0]
            return {"eco": eco, "name": name}
    return None
