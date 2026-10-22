import { GLYPHS } from "./Board.jsx";

const CHOICES = [
  { type: "q", label: "Queen" },
  { type: "r", label: "Rook" },
  { type: "b", label: "Bishop" },
  { type: "n", label: "Knight" },
];

export default function PromotionPicker({ color, onPick, onCancel }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="promotion" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose promotion piece">
        <p>Promote to</p>
        <div className="promotion-choices">
          {CHOICES.map(({ type, label }) => (
            <button key={type} onClick={() => onPick(type)} aria-label={label} title={label}>
              <span className={`piece ${color === "w" ? "white" : "black"}`}>{GLYPHS[type]}{"︎"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
