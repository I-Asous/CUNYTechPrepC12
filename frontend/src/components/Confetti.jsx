import { useMemo } from "react";

const COLORS = ["var(--accent)", "var(--sun)", "var(--mint)", "var(--sky)", "var(--grape)"];
const PIECES = 60;

// A one-off burst of falling confetti. Mount it to celebrate; it's hidden
// for people who prefer reduced motion (see styles.css).
export default function Confetti() {
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2.2 + Math.random() * 1.6,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720),
    color: COLORS[i % COLORS.length],
    round: Math.random() < 0.3,
  })), []);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className={p.round ? "round" : undefined} style={{
          left: `${p.left}%`,
          background: p.color,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          "--drift": `${p.drift}px`,
          "--spin": `${p.spin}deg`,
        }} />
      ))}
    </div>
  );
}
