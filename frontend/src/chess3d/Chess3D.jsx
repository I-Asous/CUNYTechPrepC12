import { useEffect, useMemo, useRef, useState } from "react";

import Confetti from "../components/Confetti.jsx";
import MoveHistory from "../components/MoveHistory.jsx";
import Board3D from "./Board3D.jsx";
import { BOTS_3D } from "./bot.js";
import { Game3D, moveFrom, moveTo } from "./engine.js";
import { VARIANTS, pieceRules } from "./variants.js";

const BOT_MIN_DELAY_MS = 450;
const COLORS = [
  { value: 1, label: "⚪ White" },
  { value: "random", label: "🎲 Random" },
  { value: -1, label: "⚫ Black" },
];

function statusText(status, game, playerColor, bot, thinking) {
  if (status.over) {
    if (!status.winner) return `🤝 Draw by ${status.reason}.`;
    return status.winner === playerColor ? "🏆 Checkmate! You win!" : `🫣 Checkmate. ${bot.name} wins this one.`;
  }
  if (thinking || game.turn !== playerColor) return `${bot.short}'s turn.`;
  return game.inCheck() ? "⚡ You're in check!" : "Your move!";
}

// 3D chess against a bot, in a rotatable Three.js view.
export default function Chess3D() {
  const [settings, setSettings] = useState({ variantId: "raumschach", botId: "octo", playerColor: 1 });
  const [game, setGame] = useState(() => new Game3D("raumschach"));
  const [version, setVersion] = useState(0);   // bumped after every change to `game`
  const [selected, setSelected] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const worker = useRef(null);
  const request = useRef(0);  // id of the bot request we're waiting for

  // What the player has picked for the next game (applied by "Let's play!").
  const [pick, setPick] = useState({ variantId: "raumschach", botId: "octo", color: 1 });

  const bot = BOTS_3D.find((b) => b.id === settings.botId);
  const { playerColor } = settings;
  const status = useMemo(() => game.status(), [game, version]);
  const lastMove = useMemo(() => {
    const top = game.undoStack.at(-1);
    return top ? { from: moveFrom(top.move), to: moveTo(top.move) } : null;
  }, [game, version]);

  const targets = useMemo(() => {
    const map = new Map();
    if (selected === null) return map;
    for (const move of game.legalMoves()) {
      if (moveFrom(move) === selected) map.set(moveTo(move), { move, capture: Boolean(game.cells[moveTo(move)]) });
    }
    return map;
  }, [game, version, selected]);

  useEffect(() => {
    worker.current = new Worker(new URL("./bot.worker.js", import.meta.url), { type: "module" });
    return () => worker.current.terminate();
  }, []);

  function play(move) {
    game.play(move);
    setSelected(null);
    setVersion((v) => v + 1);
  }

  // The bot's turn: ask the worker for a move, then play it.
  useEffect(() => {
    if (status.over || game.turn === playerColor) return;
    const id = ++request.current;
    setThinking(true);
    const started = Date.now();
    worker.current.onmessage = ({ data }) => {
      if (data.requestId !== request.current) return;  // a newer game or an undo replaced this request
      setTimeout(() => {
        if (id !== request.current) return;
        setThinking(false);
        if (data.move !== null) play(data.move);
      }, Math.max(0, BOT_MIN_DELAY_MS - (Date.now() - started)));
    };
    worker.current.postMessage({ requestId: id, snapshot: game.snapshot(), botId: settings.botId });
  }, [game, version]);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleSquareClick(square) {
    if (thinking || status.over || game.turn !== playerColor) return;
    if (square === null) return setSelected(null);
    const piece = game.cells[square];
    if (piece && Math.sign(piece) === playerColor) {
      setSelected(square === selected ? null : square);
    } else if (targets.has(square)) {
      play(targets.get(square).move);
    } else {
      setSelected(null);
    }
  }

  function startGame(next = pick) {
    const color = next.color === "random" ? (Math.random() < 0.5 ? 1 : -1) : next.color;
    request.current++;  // drop any reply the bot is still working on
    setThinking(false);
    setSettings({ variantId: next.variantId, botId: next.botId, playerColor: color });
    setGame(new Game3D(next.variantId));
    setSelected(null);
    setVersion((v) => v + 1);
  }

  function undo() {
    // Take back the bot's reply and the player's move, so it's the player's turn again.
    if (!game.undo()) return;
    if (game.turn !== playerColor) game.undo();
    request.current++;
    setThinking(false);
    setSelected(null);
    setVersion((v) => v + 1);
  }

  const variant = game.variant;
  const history = game.notation.map((san) => ({ san }));

  return (
    <main>
      <div className="board-column">
        <Board3D game={game} version={version} selected={selected} targets={targets} lastMove={lastMove}
                 playerColor={playerColor} viewKey={viewKey} onSquareClick={handleSquareClick} />
        <div className="controls">
          <p className="status">
            {statusText(status, game, playerColor, bot, thinking)}
            {thinking && (
              <span className="thinking"> {bot.emoji} is thinking<span className="dots"><span>.</span><span>.</span><span>.</span></span></span>
            )}
          </p>
          <div className="buttons">
            <button onClick={undo} disabled={thinking || game.notation.length === 0}>Undo</button>
            <button onClick={() => setViewKey((k) => k + 1)}>Reset view</button>
            <button onClick={() => startGame({ ...settings, color: settings.playerColor })}>New game</button>
          </div>
        </div>

        <section className="panel opponent">
          <div className="panel-header">
            <h2><span aria-hidden="true">🧊</span> Pick a game</h2>
            <p className="bot-description">
              <strong>{VARIANTS[pick.variantId].name}</strong> vs <strong>{BOTS_3D.find((b) => b.id === pick.botId).name}:</strong>{" "}
              {BOTS_3D.find((b) => b.id === pick.botId).description}
            </p>
          </div>
          <div className="bot-cards">
            {Object.values(VARIANTS).map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={pick.variantId === v.id} aria-label={v.name}
                      className={`bot-card variant-card${pick.variantId === v.id ? " chosen" : ""}`} title={v.tagline}
                      onClick={() => setPick({ ...pick, variantId: v.id })}>
                <span className="bot-emoji" aria-hidden="true">{v.emoji}</span>
                <span className="bot-name">{v.name}</span>
                <span className="bot-rating">{v.size.files}×{v.size.ranks}×{v.size.levels}</span>
              </button>
            ))}
            <span className="card-divider" aria-hidden="true" />
            {BOTS_3D.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={pick.botId === b.id} aria-label={b.name}
                      className={`bot-card${pick.botId === b.id ? " chosen" : ""}`} title={b.description}
                      onClick={() => setPick({ ...pick, botId: b.id })}>
                <span className="bot-emoji" aria-hidden="true">{b.emoji}</span>
                <span className="bot-name">{b.short}</span>
                <span className="bot-rating">{["easy", "medium", "hard"][BOTS_3D.indexOf(b)]}</span>
              </button>
            ))}
          </div>
          <div className="opponent-form">
            <div className="color-choice" role="radiogroup" aria-label="Your color">
              {COLORS.map(({ value, label }) => (
                <button key={value} type="button" role="radio" aria-checked={pick.color === value}
                        className={pick.color === value ? "chosen" : undefined} onClick={() => setPick({ ...pick, color: value })}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="start" onClick={() => startGame()}>Let's play!</button>
          </div>
        </section>
      </div>

      <div className="side-column">
        <section className="panel coach rules">
          <div className="panel-header">
            <h2><span aria-hidden="true">{variant.emoji}</span> How to play {variant.name}</h2>
          </div>
          <div className="rules-scroll">
            <p className="rules-tagline">{variant.tagline}. Drag to spin the board, scroll to zoom.</p>
            <ul className="piece-rules">
              {pieceRules(variant).map((piece) => (
                <li key={piece.type}>
                  <span className="piece-glyph" aria-hidden="true">{piece.glyph}</span>
                  <span><strong>{piece.name}</strong> {piece.rule}</span>
                </li>
              ))}
            </ul>
            <ul className="rules-notes">
              {variant.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        </section>
        <MoveHistory history={history} reviewFor={() => undefined} />
      </div>

      {status.over && status.winner === playerColor && <Confetti key={version} />}
    </main>
  );
}
