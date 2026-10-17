"""Board representation and move application for a chess game.

The board knows where the pieces are and how to apply or undo a move.
It does NOT check whether a move is legal -- that's the job of rules.py.

Squares are (row, col) tuples. Row 0 is rank 8 (black's back rank) and
col 0 is the a-file, so "a8" is (0, 0) and "h1" is (7, 7).

Pieces are single characters: uppercase for white, lowercase for black.
    P/p pawn, N/n knight, B/b bishop, R/r rook, Q/q queen, K/k king
Empty squares are None.
"""

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

FILES = "abcdefgh"
PIECE_LETTERS = set("PNBRQKpnbrqk")
PROMOTION_PIECES = set("QRBN")

# Rook starting squares and the castling right each one controls.
ROOK_CORNERS = {(7, 7): "K", (7, 0): "Q", (0, 7): "k", (0, 0): "q"}


def square_to_name(square):
    """(6, 4) -> "e2" """
    row, col = square
    return f"{FILES[col]}{8 - row}"


def name_to_square(name):
    """"e2" -> (6, 4)"""
    if len(name) != 2 or name[0] not in FILES or name[1] not in "12345678":
        raise ValueError(f"Invalid square name: {name!r}")
    return 8 - int(name[1]), FILES.index(name[0])


def color_of(piece):
    """Return "w", "b", or None for an empty square."""
    if piece is None:
        return None
    return "w" if piece.isupper() else "b"


def in_bounds(row, col):
    return 0 <= row < 8 and 0 <= col < 8


class Board:
    def __init__(self, fen=STARTING_FEN):
        self.grid = [[None] * 8 for _ in range(8)]
        self.turn = "w"              # side to move: "w" or "b"
        self.castling = "KQkq"       # remaining castling rights
        self.en_passant = None       # square a pawn can capture onto, or None
        self.halfmove_clock = 0      # moves since last capture/pawn move (50-move rule)
        self.fullmove_number = 1     # increments after black moves
        self.history = []            # undo records, one per move
        self.load_fen(fen)

    # ------------------------------------------------------------------
    # FEN import / export
    # ------------------------------------------------------------------

    def load_fen(self, fen):
        fields = fen.split()
        if len(fields) < 4:
            raise ValueError(f"FEN needs at least 4 fields: {fen!r}")
        placement, turn, castling, en_passant = fields[:4]
        halfmove = fields[4] if len(fields) > 4 else "0"
        fullmove = fields[5] if len(fields) > 5 else "1"

        rows = placement.split("/")
        if len(rows) != 8:
            raise ValueError(f"FEN placement needs 8 ranks: {placement!r}")

        grid = []
        for rank in rows:
            row = []
            for ch in rank:
                if ch.isdigit():
                    row.extend([None] * int(ch))
                elif ch in PIECE_LETTERS:
                    row.append(ch)
                else:
                    raise ValueError(f"Invalid FEN character: {ch!r}")
            if len(row) != 8:
                raise ValueError(f"FEN rank does not have 8 squares: {rank!r}")
            grid.append(row)

        if turn not in ("w", "b"):
            raise ValueError(f"Invalid side to move: {turn!r}")

        self.grid = grid
        self.turn = turn
        self.castling = "" if castling == "-" else castling
        self.en_passant = None if en_passant == "-" else name_to_square(en_passant)
        self.halfmove_clock = int(halfmove)
        self.fullmove_number = int(fullmove)
        self.history = []

    def to_fen(self):
        ranks = []
        for row in self.grid:
            rank, empty = "", 0
            for piece in row:
                if piece is None:
                    empty += 1
                else:
                    if empty:
                        rank += str(empty)
                        empty = 0
                    rank += piece
            if empty:
                rank += str(empty)
            ranks.append(rank)

        en_passant = square_to_name(self.en_passant) if self.en_passant else "-"
        return " ".join([
            "/".join(ranks),
            self.turn,
            self.castling or "-",
            en_passant,
            str(self.halfmove_clock),
            str(self.fullmove_number),
        ])

    # ------------------------------------------------------------------
    # Querying the board
    # ------------------------------------------------------------------

    def piece_at(self, square):
        row, col = square
        return self.grid[row][col]

    def pieces(self, color=None):
        """Yield (square, piece) for every piece, optionally of one color."""
        for row in range(8):
            for col in range(8):
                piece = self.grid[row][col]
                if piece is not None and (color is None or color_of(piece) == color):
                    yield (row, col), piece

    def find_king(self, color):
        king = "K" if color == "w" else "k"
        for square, piece in self.pieces(color):
            if piece == king:
                return square
        return None

    def position_key(self):
        """Identifies a position for threefold-repetition checks.

        Same as the FEN minus the move counters.
        """
        return " ".join(self.to_fen().split()[:4])

    @property
    def last_move(self):
        """(from_sq, to_sq, promotion) of the most recent move, or None."""
        return self.history[-1]["move"] if self.history else None

    # ------------------------------------------------------------------
    # Making and undoing moves
    # ------------------------------------------------------------------

    def make_move(self, from_sq, to_sq, promotion=None):
        """Apply a move and return the captured piece (or None).

        Castling is recognized as the king moving two files, and en passant as
        a pawn moving onto the en passant square. A pawn reaching the last rank
        promotes to `promotion` ("Q", "R", "B", "N"; defaults to queen).

        This does not check legality -- rules.py should only pass legal moves.
        """
        piece = self.piece_at(from_sq)
        if piece is None:
            raise ValueError(f"No piece on {square_to_name(from_sq)}")
        if color_of(piece) != self.turn:
            raise ValueError(f"It is not {color_of(piece)}'s turn")

        kind = piece.upper()
        from_row, from_col = from_sq
        to_row, to_col = to_sq
        is_promotion = kind == "P" and to_row in (0, 7)

        if is_promotion:
            promo = (promotion or "Q").upper()
            if promo not in PROMOTION_PIECES:
                raise ValueError(f"Invalid promotion piece: {promotion!r}")
            placed = promo if piece.isupper() else promo.lower()
        else:
            placed = piece

        record = {
            "move": (from_sq, to_sq, promotion if is_promotion else None),
            "state": (self.turn, self.castling, self.en_passant,
                      self.halfmove_clock, self.fullmove_number),
            "squares": [],  # (square, piece that was there before), in change order
        }

        def put(square, new_piece):
            record["squares"].append((square, self.piece_at(square)))
            self.grid[square[0]][square[1]] = new_piece

        captured = self.piece_at(to_sq)

        # En passant: the captured pawn sits beside the moving pawn, not on to_sq.
        if kind == "P" and to_sq == self.en_passant and captured is None:
            captured_sq = (from_row, to_col)
            captured = self.piece_at(captured_sq)
            put(captured_sq, None)

        # Castling: move the rook too.
        if kind == "K" and abs(to_col - from_col) == 2:
            kingside = to_col > from_col
            rook_from = (from_row, 7 if kingside else 0)
            rook_to = (from_row, 5 if kingside else 3)
            put(rook_to, self.piece_at(rook_from))
            put(rook_from, None)

        put(from_sq, None)
        put(to_sq, placed)

        # Castling rights are lost when the king moves, or when a rook
        # moves from (or is captured on) its starting corner.
        if kind == "K":
            lost = "KQ" if self.turn == "w" else "kq"
            self.castling = "".join(c for c in self.castling if c not in lost)
        for square in (from_sq, to_sq):
            if square in ROOK_CORNERS:
                self.castling = self.castling.replace(ROOK_CORNERS[square], "")

        # A two-square pawn push makes the skipped square capturable en passant.
        if kind == "P" and abs(to_row - from_row) == 2:
            self.en_passant = ((from_row + to_row) // 2, from_col)
        else:
            self.en_passant = None

        if kind == "P" or captured is not None:
            self.halfmove_clock = 0
        else:
            self.halfmove_clock += 1

        if self.turn == "b":
            self.fullmove_number += 1
        self.turn = "b" if self.turn == "w" else "w"

        self.history.append(record)
        return captured

    def undo_move(self):
        """Undo the most recent move and return it as (from_sq, to_sq, promotion)."""
        if not self.history:
            raise IndexError("No moves to undo")
        record = self.history.pop()
        for square, piece in reversed(record["squares"]):
            self.grid[square[0]][square[1]] = piece
        (self.turn, self.castling, self.en_passant,
         self.halfmove_clock, self.fullmove_number) = record["state"]
        return record["move"]

    def copy(self):
        new = Board.__new__(Board)
        new.grid = [row[:] for row in self.grid]
        new.turn = self.turn
        new.castling = self.castling
        new.en_passant = self.en_passant
        new.halfmove_clock = self.halfmove_clock
        new.fullmove_number = self.fullmove_number
        new.history = self.history[:]  # records are never mutated, so sharing is safe
        return new

    # ------------------------------------------------------------------
    # Display
    # ------------------------------------------------------------------

    def __str__(self):
        lines = []
        for row in range(8):
            cells = " ".join(p if p else "." for p in self.grid[row])
            lines.append(f"{8 - row}  {cells}")
        lines.append("")
        lines.append("   " + " ".join(FILES))
        return "\n".join(lines)

    def __repr__(self):
        return f"Board({self.to_fen()!r})"
