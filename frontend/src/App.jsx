import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

import Board from "./components/Board.jsx";
import BotPicker from "./components/BotPicker.jsx";
import CoachChat from "./components/CoachChat.jsx";
import Confetti from "./components/Confetti.jsx";
import MoveHistory from "./components/MoveHistory.jsx";
import PromotionPicker from "./components/PromotionPicker.jsx";
import { askCoach, bestMoveHint, botMove, listBots, pieceHint, reviewMove } from "./api.js";

const WELCOME = {
  id: 0,
  from: "coach",
  text: "Hoo-hoo! I'm Hoot, your coach. Make a move and I'll tell you how it went. Pick up a " +
        "piece and I'll tell you if it's the right one. Stuck? Press Hint!",
};
const OFFLINE_TEXT = "I'm napping right now (I can't reach the coaching server), so no feedback " +
                     "for the moment. Keep playing and I'll wake up when it's back.";

const COLOR_NAMES = { w: "White", b: "Black" };
const BOT_MIN_DELAY_MS = 500;  // so instant bot replies don't look like a glitch

function startMessage(opponent) {
  if (!opponent) return "New game! You're playing both sides. 🎲";
  const { bot, color } = opponent;
  return `${bot.emoji} ${bot.name} (~${bot.rating}) wants to play! You're ${COLOR_NAMES[color]}. Good luck!`;
}

function gameStatus(game, opponent) {
  const mover = COLOR_NAMES[game.turn()];
  const playerMoves = opponent && game.turn() === opponent.color;
  if (game.isCheckmate()) {
    if (!opponent) return `🏆 Checkmate! ${COLOR_NAMES[game.turn() === "w" ? "b" : "w"]} wins!`;
    return playerMoves ? `🫣 Checkmate. ${opponent.bot.name} wins this one.` : "🏆 Checkmate! You win!";
  }
  if (game.isStalemate()) return "🤝 Stalemate. It's a draw!";
  if (game.isInsufficientMaterial()) return "🤝 Draw: nobody has enough pieces left to checkmate.";
  if (game.isThreefoldRepetition()) return "🔁 Draw by threefold repetition.";
  if (game.isDraw()) return "😴 Draw by the 50-move rule.";
  if (game.inCheck()) return playerMoves ? "⚡ You're in check!" : `⚡ ${mover} is in check!`;
  if (!opponent) return `${mover} to move.`;
  return playerMoves ? "Your move!" : `${opponent.bot.name}'s turn.`;
}

function playerWon(game, opponent) {
  return game.isCheckmate() && (!opponent || game.turn() !== opponent.color);
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
  const [bots, setBots] = useState([]);
  const [opponent, setOpponent] = useState(null);   // { bot, color: the player's color } or null for free play
  const [gameId, setGameId] = useState(0);          // bumped on every new game, so stale bot replies are dropped
  const [botThinking, setBotThinking] = useState(false);
  const nextId = useRef(1);
  const offlineNotified = useRef(false);
  const botRequested = useRef(null);  // "gameId|fen" the bot was last asked to move in

  const playerToMove = !opponent || game.turn() === opponent.color;

  useEffect(() => {
    listBots().then((list) => { setBots(list); setOnline(true); }).catch(() => {});
  }, []);

  // When it's the bot's turn, ask it for a move and play it.
  useEffect(() => {
    if (!opponent || playerToMove || game.isGameOver() || pendingPromotion) return;
    const key = `${gameId}|${fen}`;
    if (botRequested.current === key) return;
    botRequested.current = key;

    setBotThinking(true);
    const delay = new Promise((resolve) => setTimeout(resolve, BOT_MIN_DELAY_MS));
    Promise.all([callCoach(botMove(fen, opponent.bot.id)), delay]).then(([reply]) => {
      if (botRequested.current !== key) return;  // new game or undo while waiting
      setBotThinking(false);
      if (!reply || game.fen() !== fen) return;
      const uci = reply.move;
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      setFen(game.fen());
    });
  }, [fen, gameId, opponent, playerToMove, pendingPromotion]);

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
    // Skip if the move was undone while we waited (a bot reply on top of it is fine).
    if (game.history({ verbose: true })[ply]?.after === move.after) {
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
    if (game.isGameOver() || !playerToMove) return;
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
    // Against a bot, take back the bot's reply too, so it's the player's turn again.
    if (opponent && game.turn() !== opponent.color && game.history().length > 0) game.undo();
    botRequested.current = null;
    setBotThinking(false);
    setFen(game.fen());
    setSelected(null);
    setPendingPromotion(null);
  }

  function newGame(nextOpponent = opponent) {
    game.reset();
    botRequested.current = null;
    setGameId((id) => id + 1);
    setOpponent(nextOpponent);
    setFlipped(nextOpponent?.color === "b");
    setBotThinking(false);
    setFen(game.fen());
    setSelected(null);
    setPendingPromotion(null);
    setReviews({});
    setMessages([WELCOME, { id: nextId.current++, from: "coach", text: startMessage(nextOpponent) }]);
  }

  function startGame(botId, colorChoice) {
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return newGame(null);
    const color = colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice;
    newGame({ bot, color });
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
        <h1><span className="logo" aria-hidden="true">♞</span> Chess Coach</h1>
        <p className="tagline">Play, practice and learn with a little help from your friends</p>
        <p className="credit">CUNY Tech Prep · Cohort 12</p>
      </header>

      <main>
        <div className="board-column">
          <Board board={game.board()} flipped={flipped} selected={selected} targets={targets}
                 lastMove={lastMove} checkSquare={kingInCheckSquare(game)} onSquareClick={handleSquareClick} />
          <div className="controls">
            <p className="status">
              {gameStatus(game, opponent)}
              {botThinking && (
                <span className="thinking"> {opponent.bot.emoji} is thinking<span className="dots"><span>.</span><span>.</span><span>.</span></span></span>
              )}
            </p>
            <div className="buttons">
              <button onClick={undo} disabled={history.length === 0}>Undo</button>
              <button onClick={() => setFlipped((f) => !f)}>Flip board</button>
              <button onClick={() => newGame()}>New game</button>
            </div>
          </div>
          <BotPicker bots={bots} opponent={opponent} onStart={startGame} />
        </div>

        <div className="side-column">
          <CoachChat messages={messages} online={online} busy={busy} onSend={sendMessage} onHint={requestHint} />
          <MoveHistory history={history} reviewFor={reviewFor} />
        </div>
      </main>

      {playerWon(game, opponent) && <Confetti key={gameId} />}

      {pendingPromotion && (
        <PromotionPicker color={game.turn()}
                         onPick={(type) => { playMove(pendingPromotion.from, pendingPromotion.to, type); setPendingPromotion(null); }}
                         onCancel={() => setPendingPromotion(null)} />
      )}
    </div>
  );
}
