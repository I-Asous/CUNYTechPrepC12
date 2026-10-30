import { useState } from "react";

const SEATS = [
  { color: "w", icon: "⚪" },
  { color: "b", icon: "⚫" },
];

// Who's in the online game, plus the link to invite someone. Sits under the
// board where the rival picker is in bot games.
export default function InvitePanel({ code, players, you, watchers }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel opponent invite">
      <div className="panel-header">
        <h2><span aria-hidden="true">🔗</span> Invite a friend</h2>
        <p className="bot-description">Send them this link, or the code <strong>{code}</strong></p>
      </div>

      <div className="invite-link">
        <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
        <button type="button" className="start" onClick={copy}>{copied ? "Copied! ✨" : "Copy link"}</button>
      </div>

      <div className="seats">
        {SEATS.map(({ color, icon }) => {
          const player = players[color];
          return (
            <span key={color} className={`seat${player?.online ? " here" : ""}`}>
              <span aria-hidden="true">{icon}</span>
              {player ? player.name : <em>waiting…</em>}
              {player && you?.color === color && " (you)"}
              {player && !player.online && <em> (away)</em>}
            </span>
          );
        })}
        {watchers > 0 && <span className="seat watchers">👀 {watchers} watching</span>}
      </div>
    </section>
  );
}
