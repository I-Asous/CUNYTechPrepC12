import { useState } from "react";
import Avatar from "./Avatar.jsx";

const FREE_PLAY = { id: "", name: "Just me", short: "Just me", description: "No bot. You play both sides." };
const FRIEND = { id: "friend", name: "A friend", short: "Friend", rating: null,
                 description: "Play someone online and chat mid-game. You'll get a link to send them." };

// "Grub the Goblin" -> "Grub", to keep the cards small.
const shortName = (bot) => bot.short ?? bot.name.split(" ")[0];

const COLORS = [
  { value: "w", emoji: "⚪", label: "White" },
  { value: "random", emoji: "🎲", label: "Random" },
  { value: "b", emoji: "⚫", label: "Black" },
];

// Choose an opponent and a color, then start a game. An empty bot id means
// free play: the player moves both sides.
export default function BotPicker({ bots, opponent, onStart }) {
  const [botId, setBotId] = useState(opponent?.bot.id ?? "");
  const [color, setColor] = useState("w");
  const choices = [FREE_PLAY, FRIEND, ...bots];
  const chosen = choices.find((bot) => bot.id === botId) ?? FREE_PLAY;

  return (
    <section className="panel setup">
      <div className="panel-header">
        <h2>Pick a rival</h2>
      </div>

      <h3 className="setup-label" id="rival-label">Opponent</h3>
      <div className="bot-cards wrap" role="radiogroup" aria-labelledby="rival-label">
        {choices.map((bot) => (
          <button key={bot.id || "free"} type="button" role="radio" aria-checked={bot.id === botId}
                  className={`bot-card${bot.id === botId ? " chosen" : ""}`}
                  onClick={() => setBotId(bot.id)} title={`${bot.name}: ${bot.description}`} aria-label={bot.name}>
            <Avatar id={bot.id || "free"} />
            <span className="bot-name">{shortName(bot)}</span>
            <span className="bot-rating">{bot.rating ? `~${bot.rating}` : bot.id ? "online" : "free play"}</span>
          </button>
        ))}
      </div>
      <p className="setup-description"><strong>{chosen.name}:</strong> {chosen.description}</p>
      {bots.length === 0 && <p className="offline-note">Bots wake up when the server runs.</p>}

      <h3 className="setup-label" id="rival-color">You play</h3>
      <div className="bot-cards" role="radiogroup" aria-labelledby="rival-color">
        {COLORS.map(({ value, emoji, label }) => (
          <button key={value} type="button" role="radio" aria-checked={color === value}
                  className={`bot-card color-card${color === value ? " chosen" : ""}`}
                  disabled={!botId} onClick={() => setColor(value)}>
            <span className="bot-emoji" aria-hidden="true">{emoji}</span>
            <span className="bot-name">{label}</span>
          </button>
        ))}
      </div>

      <button type="button" className="start" onClick={() => onStart(botId, color)}>Let's play!</button>
    </section>
  );
}
