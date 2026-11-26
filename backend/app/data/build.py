"""Download the datasets and load them into data/chess_data.sqlite.

Run from the backend folder:
    python -m app.data.build                  # everything
    python -m app.data.build openings puzzles # just these
    python -m app.data.build evals --evals-scan 20000000

The masters dataset has nothing to build; it's fetched and cached on demand.
"""

import argparse
import time

from app.data import evals, openings, puzzles
from app.data.store import DB_PATH, connect


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    all_datasets = ["openings", "puzzles", "evals"]
    # Default to None and fill in after parsing: some Python versions (e.g. 3.13.0)
    # check a list default against `choices` as a whole and reject it.
    parser.add_argument("datasets", nargs="*", choices=all_datasets, default=None)
    parser.add_argument("--puzzle-min-popularity", type=int, default=80)
    parser.add_argument("--puzzle-min-plays", type=int, default=1000)
    parser.add_argument("--evals-scan", type=int, default=5_000_000,
                        help="how many evaluation records to read from the stream")
    parser.add_argument("--evals-min-pieces", type=int, default=26)
    args = parser.parse_args()
    args.datasets = args.datasets or all_datasets

    builders = {
        "openings": lambda conn: openings.build(conn),
        "puzzles": lambda conn: puzzles.build(conn, args.puzzle_min_popularity, args.puzzle_min_plays),
        "evals": lambda conn: evals.build(conn, args.evals_scan, args.evals_min_pieces),
    }

    conn = connect()
    try:
        for name in args.datasets:
            started = time.monotonic()
            print(f"Building {name}...", flush=True)
            count = builders[name](conn)
            print(f"  {count:,} rows in {time.monotonic() - started:.0f}s", flush=True)
    finally:
        conn.close()
    print(f"Done: {DB_PATH}")


if __name__ == "__main__":
    main()
