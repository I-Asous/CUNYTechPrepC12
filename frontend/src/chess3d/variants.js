// The 3D chess variants: board size, starting position and rules text.
//
// Squares are named level + file + rank, e.g. "Bc2" is level B, file c,
// rank 2. Level A is the bottom. White starts at the bottom and moves "up"
// toward Black, so a White pawn's forward directions are +rank and +level.

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const UNICORN = 7;

export const PIECES = {
  [PAWN]: { letter: "", name: "Pawn", glyph: "♟", value: 100 },
  [KNIGHT]: { letter: "N", name: "Knight", glyph: "♞", value: 320 },
  [BISHOP]: { letter: "B", name: "Bishop", glyph: "♝", value: 300 },
  [ROOK]: { letter: "R", name: "Rook", glyph: "♜", value: 480 },
  [QUEEN]: { letter: "Q", name: "Queen", glyph: "♛", value: 950 },
  [KING]: { letter: "K", name: "King", glyph: "♚", value: 0 },
  [UNICORN]: { letter: "U", name: "Unicorn", glyph: "🦄", value: 250 },
};

const BY_LETTER = { P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN, K: KING, U: UNICORN };

// "RNBQKBNR" on a level/rank -> setup entries.
function row(pieces, level, rank, color) {
  return [...pieces].map((letter, file) => ({ type: BY_LETTER[letter], color, level, file, rank }));
}

const MOVES = {
  [ROOK]: "Slides any distance straight along a rank, a file, or up and down between levels (6 directions).",
  [BISHOP]: "Slides any distance diagonally within a flat plane: across a level, or on a slant between levels (12 directions).",
  [UNICORN]: "Slides any distance through the corners of the cubes: every step changes level, file and rank at once (8 directions).",
  [QUEEN]: "Combines every slide: straight, diagonal and corner-to-corner (26 directions).",
  [KING]: "One step in any of the 26 directions. Don't let it get checkmated!",
  [KNIGHT]: "Jumps two steps one way and one step another, including between levels. The only piece that leaps over others.",
};

export const VARIANTS = {
  raumschach: {
    id: "raumschach",
    name: "Raumschach",
    emoji: "🧊",
    tagline: "The classic 5×5×5 cube (Ferdinand Maack, 1907)",
    size: { files: 5, ranks: 5, levels: 5 },
    levelNames: "ABCDE",
    fileNames: "abcde",
    pawnDoubleStep: false,
    // A pawn promotes on the far corner row: E5 for White, A1 for Black.
    promotes: (color, x, y, z) => (color === 1 ? y === 4 && z === 4 : y === 0 && z === 0),
    setup: [
      ...row("RNKNR", 0, 0, 1), ...row("PPPPP", 0, 1, 1),
      ...row("BUQBU", 1, 0, 1), ...row("PPPPP", 1, 1, 1),
      ...row("UBQUB", 3, 4, -1), ...row("PPPPP", 3, 3, -1),
      ...row("RNKNR", 4, 4, -1), ...row("PPPPP", 4, 3, -1),
    ],
    pieces: [KING, QUEEN, ROOK, BISHOP, UNICORN, KNIGHT, PAWN],
    pawnRule: "Moves one step forward or one level toward the enemy (White: up, Black: down). " +
              "Captures one step diagonally in those directions. Promotes to a queen on the far " +
              "corner row (E5 for White, A1 for Black). No double step.",
    notes: ["White starts on levels A and B, Black on D and E.", "No castling or en passant.",
            "Checkmate wins. Stalemate, 50 moves without a capture or pawn move, or the same position three times is a draw."],
  },
  skyscraper: {
    id: "skyscraper",
    name: "Skyscraper",
    emoji: "🏙️",
    tagline: "Three stacked 8×8 boards, our own twist on chess",
    size: { files: 8, ranks: 8, levels: 3 },
    levelNames: "ABC",
    fileNames: "abcdefgh",
    pawnDoubleStep: true,
    // Promotes on the far rank, on any level.
    promotes: (color, x, y) => (color === 1 ? y === 7 : y === 0),
    setup: [
      ...row("RNBQKBNR", 0, 0, 1), ...row("PPPPPPPP", 0, 1, 1),
      ...row("RNBQKBNR", 2, 7, -1), ...row("PPPPPPPP", 2, 6, -1),
    ],
    pieces: [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN],
    pawnRule: "Moves one step forward (two from its starting square on its home level), or one level " +
              "toward the enemy (White: up, Black: down). Captures one step diagonally in those " +
              "directions. Promotes to a queen on the far rank, on any level.",
    notes: ["White starts on the ground floor (A), Black on the roof (C). The middle floor starts empty.",
            "No castling or en passant.",
            "Checkmate wins. Stalemate, 50 moves without a capture or pawn move, or the same position three times is a draw."],
  },
};

export function pieceRules(variant) {
  return variant.pieces.map((type) => ({
    type,
    ...PIECES[type],
    rule: type === PAWN ? variant.pawnRule : MOVES[type],
  }));
}
