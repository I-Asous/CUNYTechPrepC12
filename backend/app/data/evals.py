"""Precomputed Stockfish analysis from the Lichess evaluations database.

The full file is ~22 GB compressed and in no particular order, so build()
streams it and keeps only early-game positions (most pieces still on the
board), where a player's game is most likely to match. Scores are from
white's point of view: "cp" in centipawns, or "mate" in moves.
"""

import io
import json
import urllib.request

import zstandard

from app.data.store import position_key, query

SOURCE = "https://database.lichess.org/lichess_db_eval.jsonl.zst"
MAX_LINES = 3  # principal variations kept per position


def _piece_count(fen):
    return sum(char.isalpha() for char in fen.split()[0])


def build(conn, scan=5_000_000, min_pieces=26):
    """Stream the first `scan` records and keep positions with `min_pieces` or more."""
    conn.execute("DROP TABLE IF EXISTS evals")
    conn.execute("CREATE TABLE evals (position TEXT PRIMARY KEY, depth INTEGER, lines TEXT)")

    kept = 0
    with urllib.request.urlopen(SOURCE) as response:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(response), encoding="utf-8")
        for scanned, line in enumerate(text):
            if scanned >= scan:
                break
            record = json.loads(line)
            if _piece_count(record["fen"]) < min_pieces:
                continue
            deepest = max(record["evals"], key=lambda e: e["depth"])
            lines = [{key: pv[key] for key in ("cp", "mate", "line") if key in pv}
                     for pv in deepest["pvs"][:MAX_LINES]]
            conn.execute("INSERT OR REPLACE INTO evals VALUES (?, ?, ?)",
                         (position_key(record["fen"]), deepest["depth"], json.dumps(lines)))
            kept += 1

    conn.commit()
    return kept


def lookup(fen):
    """{"depth": ..., "lines": [{"cp" or "mate": ..., "line": "e2e4 e7e5 ..."}]} or None.

    Lines are ordered best first for the side to move.
    """
    rows = query("SELECT depth, lines FROM evals WHERE position = ?", (position_key(fen),))
    if not rows:
        return None
    depth, lines = rows[0]
    return {"depth": depth, "lines": json.loads(lines)}
