"""Online games between two people, with a chat both of them (and anyone
watching) can use mid-game.

Everything lives in memory, so games disappear when the server restarts.
Each game is a room with a short code. Players connect over a WebSocket;
the first two people in a room get the two colors, anyone after that can
watch and chat. Every change is broadcast to everyone in the room as the
full room state, which keeps clients simple and makes reconnecting trivial.

Each person has a secret `id`, made up by their browser and sent on every
connection so a refresh (or a second connection from the same tab) reclaims
the same seat, and a public `pid` used to tell whose chat message is whose.
"""

import json
import re
import secrets
import time

import chess
from fastapi import HTTPException, WebSocket, WebSocketDisconnect

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I/L mix-ups
CODE_LENGTH = 6
MAX_NAME = 24
MAX_TEXT = 500
MAX_CHAT = 200
IDLE_SECONDS = 6 * 60 * 60  # empty rooms older than this are cleaned up

PLAYER_ID = re.compile(r"^[A-Za-z0-9_-]{16,64}$")

COLOR_NAMES = {"w": "White", "b": "Black"}
TERMINATIONS = {
    chess.Termination.CHECKMATE: "checkmate",
    chess.Termination.STALEMATE: "stalemate",
    chess.Termination.INSUFFICIENT_MATERIAL: "insufficient material",
    chess.Termination.THREEFOLD_REPETITION: "threefold repetition",
    chess.Termination.FIFTY_MOVES: "the 50-move rule",
}

ROOMS = {}


def _clean_name(name):
    name = " ".join((name or "").split())[:MAX_NAME]
    return name or "Guest"


class Room:
    def __init__(self, code, creator_color):
        self.code = code
        self.creator_color = creator_color
        self.board = chess.Board()
        self.seats = {}          # "w"/"b" -> player
        self.watchers = {}       # id -> player, for people without a seat
        self.connections = {}    # WebSocket -> player
        self.chat = []
        self.next_message_id = 1
        self.result = None       # {"winner": "w"/"b"/None, "reason": ...}
        self.touched = time.monotonic()

    # ----- People -----

    def join(self, websocket, name, player_id):
        """Seat the person (or reclaim their seat) and return their player record."""
        name = _clean_name(name)
        if not PLAYER_ID.match(player_id or ""):
            player_id = secrets.token_urlsafe(16)
        player = next((p for p in self.seats.values() if p["id"] == player_id), None) or self.watchers.get(player_id)
        if player:
            player["name"] = name
        else:
            free = [c for c in (self.creator_color, "b" if self.creator_color == "w" else "w") if c not in self.seats]
            player = {"id": player_id, "pid": secrets.token_hex(4), "name": name,
                      "color": free[0] if free else None}
            if player["color"]:
                self.seats[player["color"]] = player
                self.system(f"{name} joined as {COLOR_NAMES[player['color']]}.")
            else:
                self.watchers[player_id] = player
                self.system(f"{name} is watching.")
        self.connections[websocket] = player
        self.touched = time.monotonic()
        return player

    def leave(self, websocket):
        self.connections.pop(websocket, None)
        self.touched = time.monotonic()

    def online(self, player):
        return any(p is player for p in self.connections.values())

    # ----- Chat -----

    def _add_chat(self, entry):
        self.chat.append({"id": self.next_message_id, "at": time.time(), **entry})
        self.next_message_id += 1
        del self.chat[:-MAX_CHAT]

    def system(self, text):
        self._add_chat({"system": True, "text": text})

    def say(self, player, text):
        text = text.strip()[:MAX_TEXT]
        if not text:
            return "Message is empty."
        self._add_chat({"system": False, "text": text, "name": player["name"],
                        "pid": player["pid"], "color": player["color"]})
        return None

    # ----- Game -----

    def move(self, player, uci):
        if not player["color"]:
            return "You're watching this game."
        if self.result:
            return "The game is over."
        if len(self.seats) < 2:
            return "Wait for your opponent to join."
        color = "w" if self.board.turn == chess.WHITE else "b"
        if player["color"] != color:
            return "It's not your turn."
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            return "That's not a move."
        if move not in self.board.legal_moves:
            return "That move isn't legal."
        self.board.push(move)

        outcome = self.board.outcome(claim_draw=True)
        if outcome:
            winner = None if outcome.winner is None else ("w" if outcome.winner == chess.WHITE else "b")
            self.result = {"winner": winner, "reason": TERMINATIONS.get(outcome.termination, "draw")}
            if winner:
                self.system(f"{self.seats[winner]['name']} wins by {self.result['reason']}!")
            else:
                self.system(f"Draw by {self.result['reason']}.")
        return None

    def resign(self, player):
        if self.result or not player["color"] or len(self.seats) < 2:
            return "You can't resign right now."
        winner = "b" if player["color"] == "w" else "w"
        self.result = {"winner": winner, "reason": "resignation"}
        self.system(f"{player['name']} resigned. {self.seats[winner]['name']} wins!")
        return None

    def rematch(self, player):
        if not self.result or not player["color"]:
            return "You can only ask for a rematch when the game is over."
        # Swap colors so each player gets a turn with White.
        self.seats = {("b" if color == "w" else "w"): p for color, p in self.seats.items()}
        for color, p in self.seats.items():
            p["color"] = color
        self.board.reset()
        self.result = None
        self.system(f"{player['name']} started a rematch. Colors swapped!")
        return None

    def handle(self, player, message):
        """Apply a message from a player; returns an error string or None."""
        kind = message.get("type")
        if kind == "chat":
            return self.say(player, str(message.get("text", "")))
        if kind == "move":
            return self.move(player, str(message.get("uci", "")))
        if kind == "resign":
            return self.resign(player)
        if kind == "rematch":
            return self.rematch(player)
        return "Unknown message."

    # ----- Broadcasting -----

    def state_for(self, player):
        return {
            "type": "state",
            "code": self.code,
            "fen": self.board.fen(),
            "moves": [m.uci() for m in self.board.move_stack],
            "players": {color: {"name": p["name"], "pid": p["pid"], "online": self.online(p)}
                        for color, p in self.seats.items()},
            "watchers": len({p["id"] for p in self.connections.values() if not p["color"]}),
            "chat": self.chat,
            "result": self.result,
            "you": {"id": player["id"], "pid": player["pid"], "name": player["name"], "color": player["color"]},
        }

    async def broadcast(self):
        for websocket, player in list(self.connections.items()):
            try:
                await websocket.send_json(self.state_for(player))
            except Exception:
                self.leave(websocket)


def create_room(color):
    """Make a new room; the creator (first to connect) plays `color`."""
    if color not in ("w", "b", "random"):
        raise HTTPException(status_code=400, detail="Color must be w, b or random")
    if color == "random":
        color = secrets.choice("wb")

    now = time.monotonic()
    for code in [c for c, r in ROOMS.items() if not r.connections and now - r.touched > IDLE_SECONDS]:
        del ROOMS[code]

    code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    while code in ROOMS:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    ROOMS[code] = Room(code, color)
    return code


async def handle_socket(websocket: WebSocket, code, name, player_id):
    """Run one person's connection to a room until they disconnect."""
    await websocket.accept()
    room = ROOMS.get(code.upper())
    if not room:
        await websocket.send_json({"type": "error", "fatal": True,
                                   "text": "There's no game with that code. It may have expired."})
        await websocket.close()
        return

    player = room.join(websocket, name, player_id)
    await room.broadcast()
    try:
        while True:
            try:
                message = json.loads(await websocket.receive_text())
            except ValueError:
                message = {}
            error = room.handle(player, message) if isinstance(message, dict) else "Unknown message."
            if error:
                await websocket.send_json({"type": "error", "text": error})
            else:
                room.touched = time.monotonic()
                await room.broadcast()
    except WebSocketDisconnect:
        pass
    finally:
        room.leave(websocket)
        await room.broadcast()
