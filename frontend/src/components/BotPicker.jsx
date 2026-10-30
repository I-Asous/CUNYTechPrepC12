import { useState } from "react";

const FREE_PLAY = { id: "", emoji: "🎲", name: "Just me", short: "Just me", description: "No bot. You play both sides." };

// "Club Player Clara" -> "Clara", to keep the cards small.
const shortName = (bot) => bot.short ?? bot.name.split(" ").at(-1);

const COLORS = [
  { value: "w", label: "⚪ White" },
  { value: "random", label: "🎲 Random" },
  { value: "b", label: "⚫ Black" },
];

// Choose an opponent and a color, then start a game. An empty bot id means
// free play: the player moves both sides.
export default function BotPicker({ bots, opponent, onStart }) {
  const [botId, setBotId] = useState(opponent?.bot.id ?? "");
  const [color, setColor] = useState("w");
  const choices = [FREE_PLAY, ...bots];
  const chosen = choices.find((bot) => bot.id === botId) ?? FREE_PLAY;

  return (
    <section className="panel opponent">
      <div className="panel-header">
        <h2><span aria-hidden="true">🎭</span> Pick a rival</h2>
        <p className="bot-description">
          <strong>{chosen.emoji} {chosen.name}:</strong> {chosen.description}
        </p>
      </div>

      <div className="bot-cards" role="radiogroup" aria-label="Opponent">
        {choices.map((bot) => (
          <button key={bot.id || "free"} type="button" role="radio" aria-checked={bot.id === botId}
                  className={`bot-card${bot.id === botId ? " chosen" : ""}`}
                  onClick={() => setBotId(bot.id)} title={`${bot.name}: ${bot.description}`} aria-label={bot.name}>
            <span className="bot-emoji" aria-hidden="true">{bot.emoji}</span>
            <span className="bot-name">{shortName(bot)}</span>
            <span className="bot-rating">{bot.rating ? `~${bot.rating}` : "free play"}</span>
          </button>
        ))}
      </div>

      <div className="opponent-form">
        {bots.length === 0 && <span className="offline-note">Bots wake up when the server runs</span>}
        <div className="color-choice" role="radiogroup" aria-label="Your color">
          {COLORS.map(({ value, label }) => (
            <button key={value} type="button" role="radio" aria-checked={color === value}
                    className={color === value ? "chosen" : undefined}
                    disabled={!botId} onClick={() => setColor(value)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="start" onClick={() => onStart(botId, color)}>Let's play!</button>
      </div>
    </section>
  );
}
