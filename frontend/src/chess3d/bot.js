// A small 3D chess bot: alpha-beta search over the engine's moves, with a
// quiescence search on captures so it doesn't stop looking mid-exchange.
// Stockfish only knows the 8×8 game, so the 3D variants need their own.

import { Game3D, moveFrom, moveTo, movePromotion } from "./engine.js";
import { PAWN, PIECES } from "./variants.js";

export const BOTS_3D = [
  { id: "snail", emoji: "🐌", name: "Shelly the Snail", short: "Shelly", description: "Takes it slow. Often wanders off mid-plan.",
    depth: 1, noise: 120, randomChance: 0.25, timeMs: 400 },
  { id: "octo", emoji: "🐙", name: "Otto the Octopus", short: "Otto", description: "Eight arms, sees two moves ahead.",
    depth: 2, noise: 25, randomChance: 0, timeMs: 1200 },
  { id: "zorp", emoji: "🛸", name: "Zorp from Space", short: "Zorp", description: "Born in zero gravity. Thinks in cubes.",
    depth: 5, noise: 4, randomChance: 0, timeMs: 1800 },
];

const MATE = 100000;
const QUIESCENCE_DEPTH = 4;

class OutOfTime extends Error {}

// Score from the side to move's point of view, in centipawns: material, a
// nudge toward the center of the cube, and pawns rewarded for advancing.
function evaluate(game) {
  const { files, ranks, levels, cells } = game;
  const cx = (files - 1) / 2, cy = (ranks - 1) / 2, cz = (levels - 1) / 2;
  let score = 0;
  for (let square = 0; square < game.size; square++) {
    const piece = cells[square];
    if (!piece) continue;
    const color = Math.sign(piece);
    const type = Math.abs(piece);
    const [x, y, z] = game.coords(square);
    let value = PIECES[type].value;
    if (type === PAWN) {
      const progress = color === 1 ? y / (ranks - 1) + z / Math.max(1, levels - 1) : (ranks - 1 - y) / (ranks - 1) + (levels - 1 - z) / Math.max(1, levels - 1);
      value += Math.round(progress * 40);
    } else if (PIECES[type].value) {
      value += Math.round(12 - 4 * (Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(z - cz)));
    }
    score += color * value;
  }
  return score * game.turn;
}

// Captures first, biggest victim with the smallest attacker first.
function ordered(game, moves) {
  const priority = (move) => {
    const victim = Math.abs(game.cells[moveTo(move)]);
    const attacker = Math.abs(game.cells[moveFrom(move)]);
    return (victim ? 10 * PIECES[victim].value + 1000 - PIECES[attacker].value : 0) + (movePromotion(move) ? 5000 : 0);
  };
  return moves.sort((a, b) => priority(b) - priority(a));
}

function search(game, depth, alpha, beta, ply, deadline) {
  if (Date.now() > deadline) throw new OutOfTime();
  if (depth <= 0) return quiesce(game, alpha, beta, QUIESCENCE_DEPTH, deadline);

  let legal = 0;
  for (const move of ordered(game, game.pseudoMoves())) {
    game.make(move);
    if (game.isAttacked(game.kings[-game.turn], game.turn)) {
      game.unmake();
      continue;
    }
    legal++;
    const score = -search(game, depth - 1, -beta, -alpha, ply + 1, deadline);
    game.unmake();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  if (!legal) return game.inCheck() ? -MATE + ply : 0;
  return alpha;
}

function quiesce(game, alpha, beta, depth, deadline) {
  const standPat = evaluate(game);
  if (standPat >= beta || depth === 0) return standPat;
  if (standPat > alpha) alpha = standPat;
  for (const move of ordered(game, game.pseudoMoves(true))) {
    game.make(move);
    if (game.isAttacked(game.kings[-game.turn], game.turn)) {
      game.unmake();
      continue;
    }
    const score = -quiesce(game, -beta, -alpha, depth - 1, deadline);
    game.unmake();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// Pick a move for the side to move in `snapshot` (from Game3D.snapshot()).
export function chooseMove(snapshot, botId) {
  const bot = BOTS_3D.find((b) => b.id === botId) ?? BOTS_3D[0];
  const game = new Game3D(snapshot.variantId, snapshot);
  const moves = game.legalMoves();
  if (!moves.length) return null;
  if (Math.random() < bot.randomChance) return moves[Math.floor(Math.random() * moves.length)];

  const deadline = Date.now() + bot.timeMs;
  let best = moves[0];
  // Deepen one ply at a time, keeping the last search that finished in time.
  for (let depth = 1; depth <= bot.depth; depth++) {
    try {
      const scored = ordered(game, [...moves]).map((move) => {
        game.make(move);
        const score = -search(game, depth - 1, -MATE, MATE, 1, deadline);
        game.unmake();
        return { move, score: score + (Math.random() * 2 - 1) * bot.noise };
      });
      scored.sort((a, b) => b.score - a.score);
      best = scored[0].move;
      if (scored[0].score > MATE / 2) break;  // found a forced mate
    } catch (error) {
      if (!(error instanceof OutOfTime)) throw error;
      // The interrupted search may have left moves made; rewind to the root.
      while (game.undoStack.length) game.unmake();
      break;
    }
  }
  return best;
}
