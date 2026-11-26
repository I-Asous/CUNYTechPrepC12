// Calls to the coaching backend. If it isn't running, every call fails and
// the UI shows the coach as offline.
//
// Positions are sent as FEN strings and moves in UCI notation ("e2e4", "e7e8q").
//
// While someone is signed in, every call carries their Clerk session token
// (see auth.jsx). Tokens only last about a minute, so a fresh one is fetched
// for each call; Clerk caches and refreshes it.

let getToken = null;

// Called by auth.jsx: Clerk's getToken while signed in, null otherwise.
export function setTokenGetter(fn) {
  getToken = fn;
}

export function isSignedIn() {
  return getToken !== null;
}

async function authHeaders() {
  if (!getToken) return {};
  try {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};  // Clerk couldn't refresh the session; carry on as a guest
  }
}

async function request(path, options = {}) {
  const headers = { ...options.headers, ...(await authHeaders()) };
  const response = await fetch(`/api${path}`, { ...options, headers });
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

// Start an online game against a friend. `color` is the creator's: "w", "b" or "random". { code }
export function createRoom(color) {
  return post("/rooms", { color });
}

// WebSocket URL for an online game (see useRoom.js for the messages).
export function roomSocketUrl(code, name, playerId) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ name, player_id: playerId ?? "" });
  return `${protocol}://${window.location.host}/api/rooms/${code}/ws?${params}`;
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

// The signed-in player: { user_id, games_saved } (games_saved is null if the
// server can't save games).
export function getMe() {
  return request("/me");
}

// Save a finished bot game to the player's match history. The server replays
// the moves and works out the result itself. Resolves to the saved game, or
// null for guests (nothing is sent).
export function saveGame(bot, color, moves) {
  if (!isSignedIn()) return Promise.resolve(null);
  return post("/games", { bot, color, moves });
}

// The player's recent saved games, newest first:
// [{ id, opponent, color, result, reason, plies, pgn, played_at }]
export function listGames(limit = 20) {
  return request(`/games?limit=${limit}`);
}
