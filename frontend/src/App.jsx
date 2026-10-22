import { useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

import Board from "./components/Board.jsx";
import CoachChat from "./components/CoachChat.jsx";
import MoveHistory from "./components/MoveHistory.jsx";
import PromotionPicker from "./components/PromotionPicker.jsx";
import { askCoach, bestMoveHint, pieceHint, reviewMove } from "./api.js";

const WELCOME = {
  id: 0,
  from: "coach",
  text: "Hi! I'm your coach. Make a move and I'll tell you how it was. Pick up a piece and " +
        "I'll tell you if it's the right one to move. Press Hint for the best move.",
};
const OFFLINE_TEXT = "I can't reach the coaching server right now, so I can't give feedback. " +
                     "You can keep playing in the meantime.";

const COLOR_NAMES = { w: "White", b: "Black" };

function gameStatus(game) {
  const mover = COLOR_NAMES[game.turn()];
  if (game.isCheckmate()) return `Checkmate. ${COLOR_NAMES[game.turn() === "w" ? "b" : "w"]} wins.`;
  if (game.isStalemate()) return "Draw by stalemate.";
  if (game.isInsufficientMaterial()) return "Draw: not enough material to checkmate.";
  if (game.isThreefoldRepetition()) return "Draw by threefold repetition.";
  if (game.isDraw()) return "Draw by the 50-move rule.";
  if (game.inCheck()) return `${mover} is in check.`;
  return `${mover} to move.`;
}

function kingInCheckSquare(game) {
  if (!game.inCheck()) return null;
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece && piece.type === "k" && piece.color === game.turn()) return piece.square;
    }
  }
  return null;
}

export default function App() {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(() => game.fen());   // bumps a re-render after every change to `game`
  const [selected, setSelected] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState(null);  // { from, to }
  const [reviews, setReviews] = useState({});       // "ply|fen after the move" -> review
  const [messages, setMessages] = useState([WELCOME]);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const offlineNotified = useRef(false);

  const history = useMemo(() => game.history({ verbose: true }), [game, fen]);
  const lastMove = history.at(-1) ?? null;

  const targets = useMemo(() => {
    const map = new Map();
    if (selected) {
      for (const move of game.moves({ square: selected, verbose: true })) {
        map.set(move.to, { capture: Boolean(move.captured), promotion: Boolean(move.promotion) });
      }
    }
    return map;
  }, [game, fen, selected]);

  function addMessage(message) {
    const entry = { ...message, id: nextId.current++ };
    setMessages((current) => {
      // Piece hints replace the previous one instead of piling up.
      if (entry.kind === "piece" && current.at(-1)?.kind === "piece") {
        return [...current.slice(0, -1), entry];
      }
      return [...current, entry];
    });
  }

  // Runs a backend request, tracks whether the coach is reachable, and
  // returns null if the request failed.
  async function callCoach(request) {
    try {
      const result = await request;
      setOnline(true);
      offlineNotified.current = false;
      return result;
    } catch {
      setOnline(false);
      if (!offlineNotified.current) {
        offlineNotified.current = true;
        addMessage({ from: "coach", kind: "offline", text: OFFLINE_TEXT });
      }
      return null;
    }
  }

  async function playMove(from, to, promotion) {
    const fenBefore = game.fen();
    const move = game.move({ from, to, promotion });
    const ply = game.history().length - 1;
    setFen(game.fen());
    setSelected(null);

    const review = await callCoach(reviewMove(fenBefore, move.lan));
    if (!review) return;
    setReviews((current) => ({ ...current, [`${ply}|${move.after}`]: review }));
    if (game.fen() === move.after) {  // skip if the move was undone while we waited
      addMessage({ from: "coach", kind: "review", quality: review.quality, text: review.message });
    }
  }

  async function selectPiece(square) {
    setSelected(square);
    const fenAtRequest = game.fen();
    const hint = await callCoach(pieceHint(fenAtRequest, square));
    if (hint && game.fen() === fenAtRequest) {
      addMessage({ from: "coach", kind: "piece", text: hint.message });
    }
  }

  function handleSquareClick(square) {
    if (game.isGameOver()) return;
    const piece = game.get(square);

    if (piece && piece.color === game.turn()) {
      if (square === selected) setSelected(null);
      else selectPiece(square);
      return;
    }

    const target = targets.get(square);
    if (selected && target) {
      if (target.promotion) setPendingPromotion({ from: selected, to: square });
      else playMove(selected, square);
    }
    setSelected(null);
  }

  function undo() {
    if (!game.undo()) return;
    setFen(game.fen());
    setSelected(null);
    setPendingPromotion(null);
  }

  function newGame() {
    game.reset();
    setFen(game.fen());
    setSelected(null);
    setPendingPromotion(null);
    setReviews({});
    setMessages([WELCOME]);
  }

  async function requestHint() {
    const hint = await callCoach(bestMoveHint(game.fen()));
    if (hint) addMessage({ from: "coach", kind: "hint", text: hint.message });
  }

  async function sendMessage(text) {
    addMessage({ from: "user", text });
    setBusy(true);
    const answer = await callCoach(askCoach(game.fen(), game.history(), text));
    setBusy(false);
    if (answer) addMessage({ from: "coach", kind: "chat", text: answer.reply });
  }

  const reviewFor = (ply) => history[ply] && reviews[`${ply}|${history[ply].after}`];

  return (
    <div className="app">
      <header>
        <h1>Chess Coach</h1>
        <p>CUNY Tech Prep · Cohort 12</p>
      </header>

      <main>
        <div className="board-column">
          <Board board={game.board()} flipped={flipped} selected={selected} targets={targets}
                 lastMove={lastMove} checkSquare={kingInCheckSquare(game)} onSquareClick={handleSquareClick} />
          <div className="controls">
            <p className="status">{gameStatus(game)}</p>
            <div className="buttons">
              <button onClick={undo} disabled={history.length === 0}>Undo</button>
              <button onClick={() => setFlipped((f) => !f)}>Flip board</button>
              <button onClick={newGame}>New game</button>
            </div>
          </div>
        </div>

        <div className="side-column">
          <CoachChat messages={messages} online={online} busy={busy} onSend={sendMessage} onHint={requestHint} />
          <MoveHistory history={history} reviewFor={reviewFor} />
        </div>
      </main>

      {pendingPromotion && (
        <PromotionPicker color={game.turn()}
                         onPick={(type) => { playMove(pendingPromotion.from, pendingPromotion.to, type); setPendingPromotion(null); }}
                         onCancel={() => setPendingPromotion(null)} />
      )}
    </div>
  );
}
