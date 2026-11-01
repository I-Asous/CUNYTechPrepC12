import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";

import Board from "./Board.jsx";
import Confetti from "./Confetti.jsx";
import GameChat from "./GameChat.jsx";
import InvitePanel from "./InvitePanel.jsx";
import MoveHistory from "./MoveHistory.jsx";
import PromotionPicker from "./PromotionPicker.jsx";
import { kingInCheckSquare, toMove } from "../chessUtils.js";
import { useRoom } from "../useRoom.js";

const NAME_KEY = "chess-coach-name";

function savedName() {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private mode */ }
}

// An online game against another person. Asks for a display name first.
export default function OnlineGame({ code, onLeave }) {
  const [name, setName] = useState(savedName);
  if (!name) {
    return <NamePrompt onDone={(chosen) => { saveName(chosen); setName(chosen); }} onLeave={onLeave} />;
  }
  return <Room code={code} name={name} onLeave={onLeave} />;
}

function NamePrompt({ onDone, onLeave }) {
  const [draft, setDraft] = useState("");
  return (
    <main className="name-prompt">
      <form className="panel" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onDone(draft.trim()); }}>
        <h2><span aria-hidden="true">👋</span> What should we call you?</h2>
        <p className="bot-description">Your friend will see this name in the game and the chat.</p>
        <div className="invite-link">
          <input autoFocus value={draft} maxLength={24} onChange={(e) => setDraft(e.target.value)}
                 placeholder="Your name" aria-label="Your name" />
          <button type="submit" className="start" disabled={!draft.trim()}>Join game</button>
        </div>
        <button type="button" className="link-button" onClick={onLeave}>← Back to the bots</button>
      </form>
    </main>
  );
}

function statusText(state, game, connection, myTurn) {
  if (connection === "missing") return "😶‍🌫️ This game couldn't be found.";
  if (!state) return "Connecting…";
  if (connection !== "open") return "🔌 Reconnecting…";
  const { players, result, you } = state;
  if (result) {
    if (!result.winner) return `🤝 Draw by ${result.reason}.`;
    if (you.color === result.winner) return `🏆 You win by ${result.reason}!`;
    return `${you.color ? "🫣" : "🏆"} ${players[result.winner]?.name} wins by ${result.reason}.`;
  }
  if (!players.w || !players.b) return "🕰️ Waiting for a friend to join…";
  if (myTurn) return game.inCheck() ? "⚡ You're in check!" : "Your move!";
  if (you.color) return `${players[game.turn()].name}'s move.`;
  return `👀 ${players.w.name} vs ${players.b.name}`;
}

function Room({ code, name, onLeave }) {
  const { state, connection, error, send } = useRoom(code, name);
  const [selected, setSelected] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);  // { from, to }
  const [flipped, setFlipped] = useState(null);                    // null: follow your color

  const moveList = (state?.moves ?? []).join(" ");
  const game = useMemo(() => {
    const g = new Chess();
    for (const uci of moveList.split(" ").filter(Boolean)) g.move(toMove(uci));
    return g;
  }, [moveList]);

  const you = state?.you;
  const players = state?.players ?? {};
  const ready = Boolean(players.w && players.b);
  const myTurn = Boolean(ready && !state.result && you?.color === game.turn() && connection === "open");
  const history = game.history({ verbose: true });

  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [moveList]);

  const targets = useMemo(() => {
    const map = new Map();
    if (selected && myTurn) {
      for (const move of game.moves({ square: selected, verbose: true })) {
        map.set(move.to, { capture: Boolean(move.captured), promotion: Boolean(move.promotion) });
      }
    }
    return map;
  }, [game, selected, myTurn]);

  function playMove(from, to, promotion) {
    send({ type: "move", uci: `${from}${to}${promotion ?? ""}` });
    setSelected(null);
  }

  function handleSquareClick(square) {
    if (!myTurn) return;
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square === selected ? null : square);
      return;
    }
    const target = targets.get(square);
    if (selected && target) {
      if (target.promotion) setPendingPromotion({ from: selected, to: square });
      else playMove(selected, square);
    }
    setSelected(null);
  }

  function resign() {
    if (window.confirm("Resign this game?")) send({ type: "resign" });
  }

  const isFlipped = flipped ?? you?.color === "b";
  const won = state?.result?.winner && state.result.winner === you?.color;

  return (
    <main>
      <div className="board-column">
        <Board board={game.board()} flipped={isFlipped} selected={selected} targets={targets}
               lastMove={history.at(-1) ?? null} checkSquare={kingInCheckSquare(game)} onSquareClick={handleSquareClick} />
        <div className="controls">
          <p className="status">
            {error && connection !== "missing" ? `⚠️ ${error}` : statusText(state, game, connection, myTurn)}
          </p>
          <div className="buttons">
            <button onClick={() => setFlipped(!isFlipped)}>Flip board</button>
            {state?.result && you?.color
              ? <button onClick={() => send({ type: "rematch" })}>Rematch</button>
              : <button onClick={resign} disabled={!ready || !you?.color || Boolean(state?.result)}>Resign</button>}
            <button onClick={onLeave}>Leave</button>
          </div>
        </div>
        <InvitePanel code={code} players={players} you={you} watchers={state?.watchers ?? 0} />
      </div>

      <div className="side-column">
        <GameChat messages={state?.chat ?? []} me={you?.pid} online={connection === "open"}
                  onSend={(text) => send({ type: "chat", text })} />
        <MoveHistory history={history} reviewFor={() => undefined} />
      </div>

      {won && <Confetti key={moveList} />}

      {pendingPromotion && (
        <PromotionPicker color={game.turn()}
                         onPick={(type) => { playMove(pendingPromotion.from, pendingPromotion.to, type); setPendingPromotion(null); }}
                         onCancel={() => setPendingPromotion(null)} />
      )}
    </main>
  );
}
