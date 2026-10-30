// Calls to the coaching backend. If it isn't running, every call fails and
// the UI shows the coach as offline.
//
// Positions are sent as FEN strings and moves in UCI notation ("e2e4", "e7e8q").

async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`);
  }
  return response.json();
}

function post(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Opponents to practice against, weakest first: [{ id, name, rating, description }]
export function listBots() {
  return request("/bots");
}

// The bot's reply in the position: { move }
export function botMove(fen, bot) {
  return post("/bot-move", { fen, bot });
}

// Grade a move: { quality: "best" | "good" | "inaccuracy" | "mistake" | "blunder", message }
export function reviewMove(fen, move) {
  return post("/review", { fen, move });
}

// Is the piece on `square` the right one to move? { is_best, message }
export function pieceHint(fen, square) {
  return post("/piece-hint", { fen, square });
}

// Best move in the position and why: { best, message }
export function bestMoveHint(fen) {
  return post("/hint", { fen });
}

// Free-form question to the coach: { reply }
export function askCoach(fen, history, message) {
  return post("/chat", { fen, history, message });
}
