// Rules engine for the 3D variants (see variants.js).
//
// The board is a flat Int8Array: each cell holds 0 for empty, or
// color * type, with White = 1 and Black = -1 (so +PAWN is a White pawn).
// Square index = x + y * files + z * files * ranks, where x is the file,
// y the rank and z the level.
//
// Moves are packed into one integer: from | to << 8 | promotion << 16.
// Boards have at most 192 squares, so 8 bits per square is enough.

import { BISHOP, KING, KNIGHT, PAWN, PIECES, QUEEN, ROOK, UNICORN, VARIANTS } from "./variants.js";

export const WHITE = 1;
export const BLACK = -1;

// The 26 directions to a neighbouring cube, tagged with how many axes change:
// 1 = straight (rook), 2 = flat diagonal (bishop), 3 = corner diagonal (unicorn).
const DIRECTIONS = [];
for (const dx of [-1, 0, 1]) {
  for (const dy of [-1, 0, 1]) {
    for (const dz of [-1, 0, 1]) {
      const axes = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (axes) DIRECTIONS.push({ dx, dy, dz, axes });
    }
  }
}

const SLIDES = {
  [ROOK]: DIRECTIONS.filter((d) => d.axes === 1),
  [BISHOP]: DIRECTIONS.filter((d) => d.axes === 2),
  [UNICORN]: DIRECTIONS.filter((d) => d.axes === 3),
  [QUEEN]: DIRECTIONS,
};

// Which slider types can travel a direction with this many changing axes.
const SLIDERS_BY_AXES = { 1: [ROOK, QUEEN], 2: [BISHOP, QUEEN], 3: [UNICORN, QUEEN] };

// (0, 1, 2) leaps in every order and sign: 24 of them.
const KNIGHT_JUMPS = [];
for (const [a, b] of [[1, 2], [2, 1]]) {
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      KNIGHT_JUMPS.push([sa * a, sb * b, 0], [sa * a, 0, sb * b], [0, sa * a, sb * b]);
    }
  }
}

// A pawn of `color` captures one step diagonally in its forward directions:
// forward + sideways, up + sideways, forward + up (up = toward the enemy).
function pawnCaptures(color) {
  return [[-1, color, 0], [1, color, 0], [-1, 0, color], [1, 0, color], [0, color, color]];
}

export const encodeMove = (from, to, promotion = 0) => from | (to << 8) | (promotion << 16);
export const moveFrom = (move) => move & 0xff;
export const moveTo = (move) => (move >> 8) & 0xff;
export const movePromotion = (move) => move >> 16;

export class Game3D {
  constructor(variantId, snapshot = null) {
    const variant = VARIANTS[variantId];
    this.variant = variant;
    const { files, ranks, levels } = variant.size;
    this.files = files;
    this.ranks = ranks;
    this.levels = levels;
    this.size = files * ranks * levels;
    this.cells = new Int8Array(this.size);
    this.turn = WHITE;
    this.halfmoveClock = 0;
    this.undoStack = [];
    this.notation = [];             // one entry per move played with play()
    this.positionCounts = new Map();

    if (snapshot) {
      this.cells.set(snapshot.cells);
      this.turn = snapshot.turn;
      this.halfmoveClock = snapshot.halfmoveClock;
    } else {
      for (const { type, color, level, file, rank } of variant.setup) {
        this.cells[this.index(file, rank, level)] = color * type;
      }
    }
    this.kings = { [WHITE]: this.cells.indexOf(KING), [BLACK]: this.cells.indexOf(-KING) };
    this._countPosition(1);
  }

  // A plain-object copy that can be sent to the bot's worker.
  snapshot() {
    return { variantId: this.variant.id, cells: Array.from(this.cells), turn: this.turn, halfmoveClock: this.halfmoveClock };
  }

  index(x, y, z) {
    return x + y * this.files + z * this.files * this.ranks;
  }

  coords(square) {
    const x = square % this.files;
    const y = Math.floor(square / this.files) % this.ranks;
    const z = Math.floor(square / (this.files * this.ranks));
    return [x, y, z];
  }

  inside(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.files && y < this.ranks && z < this.levels;
  }

  squareName(square) {
    const [x, y, z] = this.coords(square);
    return `${this.variant.levelNames[z]}${this.variant.fileNames[x]}${y + 1}`;
  }

  // ----- Attacks -----

  // Is `square` attacked by any piece of color `by`?
  isAttacked(square, by) {
    const [x, y, z] = this.coords(square);
    const cells = this.cells;

    for (const { dx, dy, dz, axes } of DIRECTIONS) {
      let cx = x + dx, cy = y + dy, cz = z + dz, steps = 1;
      while (this.inside(cx, cy, cz)) {
        const piece = cells[this.index(cx, cy, cz)];
        if (piece) {
          if (Math.sign(piece) === by) {
            const type = Math.abs(piece);
            if (SLIDERS_BY_AXES[axes].includes(type) || (type === KING && steps === 1)) return true;
          }
          break;
        }
        cx += dx; cy += dy; cz += dz; steps++;
      }
    }

    for (const [dx, dy, dz] of KNIGHT_JUMPS) {
      const cx = x + dx, cy = y + dy, cz = z + dz;
      if (this.inside(cx, cy, cz) && cells[this.index(cx, cy, cz)] === by * KNIGHT) return true;
    }

    // An attacking pawn sits one capture-step behind the square.
    for (const [dx, dy, dz] of pawnCaptures(by)) {
      const cx = x - dx, cy = y - dy, cz = z - dz;
      if (this.inside(cx, cy, cz) && cells[this.index(cx, cy, cz)] === by * PAWN) return true;
    }
    return false;
  }

  inCheck(color = this.turn) {
    return this.isAttacked(this.kings[color], -color);
  }

  // ----- Move generation -----

  // Moves that follow each piece's movement rules, ignoring whether they
  // leave the mover's own king in check. Captures only, if `capturesOnly`.
  pseudoMoves(capturesOnly = false) {
    const moves = [];
    const color = this.turn;
    const cells = this.cells;

    for (let from = 0; from < this.size; from++) {
      const piece = cells[from];
      if (!piece || Math.sign(piece) !== color) continue;
      const type = Math.abs(piece);
      const [x, y, z] = this.coords(from);

      const add = (to) => {
        const target = cells[to];
        if (target && Math.sign(target) === color) return false;
        if (!capturesOnly || target) moves.push(encodeMove(from, to));
        return !target;  // a slider keeps going only over empty squares
      };

      if (type === PAWN) {
        this._pawnMoves(from, x, y, z, color, capturesOnly, moves);
      } else if (type === KNIGHT) {
        for (const [dx, dy, dz] of KNIGHT_JUMPS) {
          if (this.inside(x + dx, y + dy, z + dz)) add(this.index(x + dx, y + dy, z + dz));
        }
      } else if (type === KING) {
        for (const { dx, dy, dz } of DIRECTIONS) {
          if (this.inside(x + dx, y + dy, z + dz)) add(this.index(x + dx, y + dy, z + dz));
        }
      } else {
        for (const { dx, dy, dz } of SLIDES[type]) {
          let cx = x + dx, cy = y + dy, cz = z + dz;
          while (this.inside(cx, cy, cz) && add(this.index(cx, cy, cz))) {
            cx += dx; cy += dy; cz += dz;
          }
        }
      }
    }
    return moves;
  }

  _pawnMoves(from, x, y, z, color, capturesOnly, moves) {
    const push = (to) => {
      const [tx, ty, tz] = this.coords(to);
      const promotion = this.variant.promotes(color, tx, ty, tz) ? QUEEN : 0;
      moves.push(encodeMove(from, to, promotion));
    };

    for (const [dx, dy, dz] of pawnCaptures(color)) {
      const tx = x + dx, ty = y + dy, tz = z + dz;
      if (!this.inside(tx, ty, tz)) continue;
      const target = this.cells[this.index(tx, ty, tz)];
      if (target && Math.sign(target) === -color) push(this.index(tx, ty, tz));
    }
    if (capturesOnly) return;

    for (const [dy, dz] of [[color, 0], [0, color]]) {
      if (this.inside(x, y + dy, z + dz) && !this.cells[this.index(x, y + dy, z + dz)]) {
        push(this.index(x, y + dy, z + dz));
      }
    }

    // Double step: straight forward from the starting rank on the home level.
    const startRank = color === 1 ? 1 : this.ranks - 2;
    const homeLevel = color === 1 ? 0 : this.levels - 1;
    if (this.variant.pawnDoubleStep && y === startRank && z === homeLevel
        && !this.cells[this.index(x, y + color, z)] && !this.cells[this.index(x, y + 2 * color, z)]) {
      push(this.index(x, y + 2 * color, z));
    }
  }

  legalMoves() {
    return this.pseudoMoves().filter((move) => {
      this.make(move);
      const safe = !this.isAttacked(this.kings[-this.turn], this.turn);
      this.unmake();
      return safe;
    });
  }

  // ----- Making moves -----

  make(move) {
    const from = moveFrom(move), to = moveTo(move), promotion = movePromotion(move);
    const piece = this.cells[from];
    const captured = this.cells[to];
    this.undoStack.push({ move, captured, halfmoveClock: this.halfmoveClock });

    this.cells[to] = promotion ? Math.sign(piece) * promotion : piece;
    this.cells[from] = 0;
    if (Math.abs(piece) === KING) this.kings[Math.sign(piece)] = to;
    this.halfmoveClock = captured || Math.abs(piece) === PAWN ? 0 : this.halfmoveClock + 1;
    this.turn = -this.turn;
  }

  unmake() {
    const { move, captured, halfmoveClock } = this.undoStack.pop();
    const from = moveFrom(move), to = moveTo(move), promotion = movePromotion(move);
    const piece = promotion ? Math.sign(this.cells[to]) * PAWN : this.cells[to];
    this.cells[from] = piece;
    this.cells[to] = captured;
    if (Math.abs(piece) === KING) this.kings[Math.sign(piece)] = from;
    this.halfmoveClock = halfmoveClock;
    this.turn = -this.turn;
  }

  // ----- Playing a game (with notation and draw tracking) -----

  _positionKey() {
    return `${this.turn}:${this.cells.join(",")}`;
  }

  _countPosition(delta) {
    const key = this._positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) ?? 0) + delta);
  }

  describe(move) {
    const from = moveFrom(move), to = moveTo(move);
    const piece = PIECES[Math.abs(this.cells[from])];
    const capture = this.cells[to] ? "x" : "-";
    const promotion = movePromotion(move) ? `=${PIECES[movePromotion(move)].letter}` : "";
    return `${piece.letter}${this.squareName(from)}${capture}${this.squareName(to)}${promotion}`;
  }

  // Play a legal move for real, recording its notation ("NAb1-Bb3+").
  play(move) {
    let text = this.describe(move);
    this.make(move);
    this._countPosition(1);
    const status = this.status();
    if (status.reason === "checkmate") text += "#";
    else if (this.inCheck()) text += "+";
    this.notation.push(text);
    return text;
  }

  undo() {
    if (!this.notation.length) return false;
    this._countPosition(-1);
    this.unmake();
    this.notation.pop();
    return true;
  }

  // { over, winner: WHITE/BLACK/null, reason }
  status() {
    if (!this.legalMoves().length) {
      return this.inCheck()
        ? { over: true, winner: -this.turn, reason: "checkmate" }
        : { over: true, winner: null, reason: "stalemate" };
    }
    if (this.cells.every((piece) => !piece || Math.abs(piece) === KING)) {
      return { over: true, winner: null, reason: "only kings left" };
    }
    if (this.halfmoveClock >= 100) return { over: true, winner: null, reason: "the 50-move rule" };
    if ((this.positionCounts.get(this._positionKey()) ?? 0) >= 3) {
      return { over: true, winner: null, reason: "threefold repetition" };
    }
    return { over: false, winner: null, reason: null };
  }
}
