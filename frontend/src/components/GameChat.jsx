import { useEffect, useRef, useState } from "react";

const REACTIONS = ["👋", "😮", "😅", "🔥", "🤝", "gg"];

// Chat between the players (and anyone watching) in an online game.
export default function GameChat({ messages, me, online, onSend }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section className="panel coach game-chat">
      <div className="panel-header">
        <h2><span aria-hidden="true">💬</span> Game chat</h2>
        <span className={`status-dot ${online ? "online" : "offline"}`}>{online ? "Connected" : "Reconnecting"}</span>
      </div>

      <div className="messages" aria-live="polite">
        {messages.map((message) => {
          if (message.system) return <div key={message.id} className="message system">{message.text}</div>;
          const mine = message.pid === me;
          return (
            <div key={message.id} className={`message ${mine ? "user" : "coach other"}`}>
              {!mine && (
                <span className={`chat-name ${message.color ?? "watcher"}`}>
                  {message.name}{!message.color && " 👀"}
                </span>
              )}
              {message.text}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="reactions" aria-label="Quick reactions">
        {REACTIONS.map((reaction) => (
          <button key={reaction} type="button" disabled={!online} onClick={() => onSend(reaction)}>{reaction}</button>
        ))}
      </div>

      <form className="chat-input" onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500}
               placeholder="Say something nice…" aria-label="Message the other players" />
        <button type="submit" disabled={!draft.trim() || !online}>Send</button>
      </form>
    </section>
  );
}
