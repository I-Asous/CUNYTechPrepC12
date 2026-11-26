"""Move statistics from master-level games, via the Lichess explorer API.

The API needs a Lichess personal access token (free, no scopes needed:
https://lichess.org/account/oauth/token). Set it as LICHESS_TOKEN in the
environment. Without one, lookups return None.

Answers are cached in the dataset database, so each position is fetched
from Lichess only once.
"""

import json
import os
import sqlite3
import urllib.parse
import urllib.request

from app.data.store import DB_PATH, connect, position_key

SOURCE = "https://explorer.lichess.ovh/masters"


def _cached(key):
    if not DB_PATH.exists():
        return None
    conn = connect()
    try:
        row = conn.execute("SELECT response FROM masters_cache WHERE position = ?", (key,)).fetchone()
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()
    return json.loads(row[0]) if row else None


def _save(key, stats):
    conn = connect()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS masters_cache (position TEXT PRIMARY KEY, response TEXT)")
        conn.execute("INSERT OR REPLACE INTO masters_cache VALUES (?, ?)", (key, json.dumps(stats)))
        conn.commit()
    finally:
        conn.close()


def _fetch(fen, token):
    url = f"{SOURCE}?{urllib.parse.urlencode({'fen': fen, 'moves': 8, 'topGames': 0})}"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=5) as response:
        data = json.load(response)

    def games(entry):
        return entry["white"] + entry["draws"] + entry["black"]

    return {
        "games": games(data),
        "opening": data.get("opening"),
        "moves": [{"uci": move["uci"], "san": move["san"], "games": games(move),
                   "white": move["white"], "draws": move["draws"], "black": move["black"]}
                  for move in data["moves"]],
    }


def lookup(fen):
    """{"games": N, "opening": {...} or None, "moves": [{"uci", "san", "games", "white", "draws", "black"}]}

    Moves are ordered most played first. Returns None if there's no token
    or the request fails.
    """
    key = position_key(fen)
    stats = _cached(key)
    if stats is not None:
        return stats

    token = os.environ.get("LICHESS_TOKEN")
    if not token:
        return None
    try:
        stats = _fetch(fen, token)
    except (OSError, ValueError, KeyError):
        return None
    _save(key, stats)
    return stats
