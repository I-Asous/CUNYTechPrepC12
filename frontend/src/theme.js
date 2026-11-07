import { useSyncExternalStore } from "react";

// Two looks for the whole site, like a light/dark switch:
//   "drawing" - one red ink on white paper (the default)
//   "gallery" - white type and black/white caption strips over a painting
// The choice lives on <html data-theme>, and index.html applies the saved
// one before the page first paints.

const STORAGE_KEY = "chess-coach-theme";
const listeners = new Set();

export function getTheme() {
  return document.documentElement.dataset.theme === "gallery" ? "gallery" : "drawing";
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  if (theme === "gallery") showPainting();
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme);
}

// The gallery's painting is generated in the browser the first time it's
// needed, then handed to the CSS as --art.
let painting = null;
function showPainting() {
  painting ??= import("./painting.js")
    .then(({ paint }) => paint())
    .then((url) => document.documentElement.style.setProperty("--art", `url("${url}")`))
    .catch(() => { painting = null; });  // the CSS falls back to a gradient
}

if (getTheme() === "gallery") showPainting();
