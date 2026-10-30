import { useEffect, useRef, useState } from "react";

// A reaction sticker on each move review.
const STICKERS = { best: "🌟", good: "👍", inaccuracy: "🤔", mistake: "😬", blunder: "💥" };

export default function CoachChat({ messages, online, busy, onSend, onHint }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section className="panel coach">
      <div className="panel-header">
        <h2><span aria-hidden="true">🦉</span> Coach Hoot</h2>
        <span className={`status-dot ${online ? "online" : "offline"}`}>{online ? "Awake" : "Napping"}</span>
      </div>

      <div className="messages" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.from} ${message.quality ?? ""}`}>
            {STICKERS[message.quality] && (
              <span className="sticker" role="img" aria-label={message.quality}>{STICKERS[message.quality]}</span>
            )}
            {message.text}
          </div>
        ))}
        {busy && (
          <div className="message coach typing" aria-label="Coach is thinking">
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={submit}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
               placeholder="Ask Hoot anything about this position…" aria-label="Message the coach" />
        <button type="submit" disabled={!draft.trim()}>Send</button>
        <button type="button" className="secondary" onClick={onHint}>💡 Hint</button>
      </form>
    </section>
  );
}
