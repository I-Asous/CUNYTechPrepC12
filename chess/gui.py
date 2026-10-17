"""Pygame GUI for the chess board.

Run with:  python3 gui.py

Controls:
    click a piece, then click a square to move it
    U  undo        R  reset        F  flip board
"""

import sys

import pygame

from board import Board, FILES, color_of

SQUARE = 80
BOARD_PX = SQUARE * 8
STATUS_H = 40
FPS = 60

LIGHT = (240, 217, 181)
DARK = (181, 136, 99)
SELECTED = (246, 246, 105, 160)
LAST_MOVE = (205, 210, 106, 120)
WHITE_PIECE = (255, 255, 255)
BLACK_PIECE = (20, 20, 20)
STATUS_BG = (40, 40, 40)
STATUS_FG = (230, 230, 230)

# The solid glyphs are used for both colors; white pieces get a black outline
# drawn around them so they stay visible on light squares.
GLYPHS = {"K": "♚", "Q": "♛", "R": "♜",
          "B": "♝", "N": "♞", "P": "♟"}
OUTLINE_PX = 2

PIECE_HEIGHT = int(SQUARE * 0.75)  # height of the tallest piece; others scale with it

# Fonts with solid chess symbols on macOS, Windows and Linux, in order of
# preference. Apple Symbols is last because some of its "solid" pieces are hollow.
PIECE_FONTS = ["menlo", "segoeuisymbol", "dejavusans", "notosanssymbols2",
               "freeserif", "arialunicodems", "applesymbols"]


def load_piece_font():
    """Return the first installed font that actually has the chess glyphs.

    match_font silently falls back to a different font when one isn't
    installed, and that font draws the same placeholder box for every
    missing glyph -- so six identical renders means the glyphs are missing.
    """
    for name in PIECE_FONTS:
        path = pygame.font.match_font(name)
        if path is None:
            continue
        font = pygame.font.Font(path, SQUARE)
        renders = {pygame.image.tobytes(font.render(g, True, (0, 0, 0)), "RGBA")
                   for g in GLYPHS.values()}
        if len(renders) == len(GLYPHS):
            return font
    raise RuntimeError("No installed font has the chess piece symbols")


class ChessGUI:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Chess")
        self.screen = pygame.display.set_mode((BOARD_PX, BOARD_PX + STATUS_H))
        self.clock = pygame.time.Clock()
        self.piece_font = load_piece_font()
        tallest = max(self.piece_font.render(g, True, BLACK_PIECE).get_bounding_rect().height
                      for g in GLYPHS.values())
        self.piece_scale = PIECE_HEIGHT / tallest
        self.label_font = pygame.font.SysFont(None, 18)
        self.status_font = pygame.font.SysFont(None, 26)
        self.piece_images = {p: self.render_piece(p) for p in "PNBRQKpnbrqk"}

        self.board = Board()
        self.selected = None   # square of the piece the player picked up
        self.flipped = False   # True = black at the bottom

    def square_rect(self, square):
        row, col = square
        if self.flipped:
            row, col = 7 - row, 7 - col
        return pygame.Rect(col * SQUARE, row * SQUARE, SQUARE, SQUARE)

    def square_at(self, pos):
        x, y = pos
        if not (0 <= x < BOARD_PX and 0 <= y < BOARD_PX):
            return None
        row, col = y // SQUARE, x // SQUARE
        if self.flipped:
            row, col = 7 - row, 7 - col
        return row, col

    def allowed_targets(self, square):
        """Squares the piece on `square` may move to.

        Placeholder until rules.py exists: anywhere not occupied by a
        friendly piece.
        """
        color = color_of(self.board.piece_at(square))
        return {(r, c) for r in range(8) for c in range(8)
                if color_of(self.board.piece_at((r, c))) != color}

    def handle_click(self, pos):
        square = self.square_at(pos)
        if square is None:
            return
        piece = self.board.piece_at(square)

        # Clicking one of your own pieces (re)selects it.
        if color_of(piece) == self.board.turn:
            self.selected = None if square == self.selected else square
            return

        if self.selected is not None and square in self.allowed_targets(self.selected):
            self.board.make_move(self.selected, square)  # promotion defaults to queen
        self.selected = None

    def handle_key(self, key):
        if key == pygame.K_u and self.board.history:
            self.board.undo_move()
            self.selected = None
        elif key == pygame.K_r:
            self.board = Board()
            self.selected = None
        elif key == pygame.K_f:
            self.flipped = not self.flipped

    def draw(self):
        self.draw_squares()
        self.draw_highlights()
        self.draw_labels()
        self.draw_pieces()
        self.draw_status()
        pygame.display.flip()

    def draw_squares(self):
        for row in range(8):
            for col in range(8):
                color = LIGHT if (row + col) % 2 == 0 else DARK
                pygame.draw.rect(self.screen, color, self.square_rect((row, col)))

    def draw_highlights(self):
        overlay = pygame.Surface((SQUARE, SQUARE), pygame.SRCALPHA)
        last = self.board.last_move
        if last:
            overlay.fill(LAST_MOVE)
            for square in last[:2]:
                self.screen.blit(overlay, self.square_rect(square))
        if self.selected is not None:
            overlay.fill(SELECTED)
            self.screen.blit(overlay, self.square_rect(self.selected))

    def draw_labels(self):
        # File letters along the bottom edge, rank numbers along the left edge.
        for i in range(8):
            col = 7 - i if self.flipped else i
            row = 7 - i if self.flipped else i
            file_sq = (7 if not self.flipped else 0, col)
            rank_sq = (row, 0 if not self.flipped else 7)

            rect = self.square_rect(file_sq)
            text = self.label_font.render(FILES[col], True, self.label_color(file_sq))
            self.screen.blit(text, (rect.right - text.get_width() - 3,
                                    rect.bottom - text.get_height() - 2))

            rect = self.square_rect(rank_sq)
            text = self.label_font.render(str(8 - row), True, self.label_color(rank_sq))
            self.screen.blit(text, (rect.left + 3, rect.top + 2))

    def label_color(self, square):
        # Use the opposite square color so labels are readable.
        return DARK if sum(square) % 2 == 0 else LIGHT

    def render_piece(self, piece):
        """Pre-render a piece glyph onto a transparent surface."""
        glyph = GLYPHS[piece.upper()]
        image = pygame.Surface((SQUARE, SQUARE), pygame.SRCALPHA)
        center = (SQUARE // 2, SQUARE // 2)
        if piece.isupper():
            # Stamp the glyph in black at small offsets to form an outline,
            # then draw the white fill on top.
            outline = self.glyph_surface(glyph, BLACK_PIECE)
            for dx in (-OUTLINE_PX, 0, OUTLINE_PX):
                for dy in (-OUTLINE_PX, 0, OUTLINE_PX):
                    image.blit(outline, outline.get_rect(center=(center[0] + dx, center[1] + dy)))
            fill = self.glyph_surface(glyph, WHITE_PIECE)
        else:
            fill = self.glyph_surface(glyph, BLACK_PIECE)
        image.blit(fill, fill.get_rect(center=center))
        return image

    def glyph_surface(self, glyph, color):
        """Render a glyph cropped to its ink, scaled so pieces look the same in any font."""
        surface = self.piece_font.render(glyph, True, color)
        surface = surface.subsurface(surface.get_bounding_rect())
        width, height = surface.get_size()
        size = (round(width * self.piece_scale), round(height * self.piece_scale))
        return pygame.transform.smoothscale(surface, size)

    def draw_pieces(self):
        for square, piece in self.board.pieces():
            self.screen.blit(self.piece_images[piece], self.square_rect(square))

    def draw_status(self):
        bar = pygame.Rect(0, BOARD_PX, BOARD_PX, STATUS_H)
        pygame.draw.rect(self.screen, STATUS_BG, bar)
        side = "White" if self.board.turn == "w" else "Black"
        message = f"{side} to move  |  move {self.board.fullmove_number}"
        hints = "U undo   R reset   F flip"
        text = self.status_font.render(message, True, STATUS_FG)
        self.screen.blit(text, text.get_rect(midleft=(12, bar.centery)))
        text = self.status_font.render(hints, True, STATUS_FG)
        self.screen.blit(text, text.get_rect(midright=(BOARD_PX - 12, bar.centery)))

    def run(self):
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    self.handle_click(event.pos)
                elif event.type == pygame.KEYDOWN:
                    self.handle_key(event.key)
            self.draw()
            self.clock.tick(FPS)


if __name__ == "__main__":
    ChessGUI().run()
