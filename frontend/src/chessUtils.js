// Small helpers shared by the bot games (App.jsx) and online games (OnlineGame.jsx).

// "e7e8q" -> { from: "e7", to: "e8", promotion: "q" }, the shape chess.js's move() takes.
export function toMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

// The square of the side to move's king if it's in check, for highlighting.
export function kingInCheckSquare(game) {
  if (!game.inCheck()) return null;
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece && piece.type === "k" && piece.color === game.turn()) return piece.square;
    }
  }
  return null;
}
