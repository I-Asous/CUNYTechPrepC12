"""Chess datasets the coach draws on.

Each module wraps one source and exposes lookups by position:
    openings  -- Lichess chess-openings: opening names and book positions
    puzzles   -- Lichess puzzle database: tactics tagged by theme
    evals     -- Lichess evaluations database: precomputed Stockfish analysis
    masters   -- Lichess masters explorer API: what strong players play here

Build the local copies with `python -m app.data.build` (see build.py).
Lookups return None or [] when a dataset hasn't been built, so the API
still runs without them.
"""
