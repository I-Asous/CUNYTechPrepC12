import { setTheme, useTheme } from "../theme.js";

// A two-way switch between the site's looks, like a light/dark toggle: a
// pencil for the drawing theme, a palette for the gallery theme. The lit
// half is the theme in use.
export default function ThemeToggle() {
  const gallery = useTheme() === "gallery";
  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={gallery} aria-label="Gallery theme"
            title={gallery ? "Switch to the drawing theme" : "Switch to the gallery theme"}
            onClick={() => setTheme(gallery ? "drawing" : "gallery")}>
      <span className={`theme-option${gallery ? "" : " on"}`} aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M2.5 13.5V11L10.5 3L13 5.5L5 13.5ZM9 4.5L11.5 7" /></svg>
      </span>
      <span className={`theme-option${gallery ? " on" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="M8 2.5C4.5 2.5 2 5 2 8C2 11 4.5 13.5 7.5 13.5C8.7 13.5 9 12.6 8.6 11.9C8.1 11 8.6 10.2 9.6 10.2H11C12.7 10.2 14 9 14 7.4C14 4.6 11.3 2.5 8 2.5Z" />
          <circle cx="5.2" cy="7.4" r="1" />
          <circle cx="7.8" cy="5.2" r="1" />
          <circle cx="10.8" cy="6" r="1" />
        </svg>
      </span>
    </button>
  );
}
