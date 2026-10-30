import { useCallback, useEffect, useRef, useState } from "react";

import { roomSocketUrl } from "./api.js";

const RECONNECT_MS = 2000;
const ERROR_MS = 3500;

// Each tab makes up its own secret player id per room, before connecting, so
// every connection from the tab (a refresh, a reconnect, React mounting
// twice in development) reclaims the same seat. Per tab, so two tabs can be
// two players.
const fallbackIds = {};

function playerIdFor(code) {
  const key = `chess-room-${code}`;
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    fallbackIds[code] ??= crypto.randomUUID();  // storage blocked: keep it for this page load
    return fallbackIds[code];
  }
}

// Live connection to an online game. The server sends the whole room state
// after every change:
//   { type: "state", code, fen, moves: [uci], players: { w, b: { name, pid, online } },
//     watchers, chat: [{ id, system, text, name, pid, color }], result, you: { id, pid, name, color } }
// and { type: "error", text, fatal? } when something we sent was rejected.
// Send { type: "move", uci }, { type: "chat", text }, { type: "resign" } or { type: "rematch" }.
export function useRoom(code, name) {
  const [state, setState] = useState(null);
  const [connection, setConnection] = useState("connecting");  // connecting | open | missing
  const [error, setError] = useState(null);
  const socket = useRef(null);

  useEffect(() => {
    let stopped = false;
    let retry;

    function connect() {
      const ws = new WebSocket(roomSocketUrl(code, name, playerIdFor(code)));
      socket.current = ws;
      ws.onopen = () => setConnection("open");
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "state") {
          setState(message);
        } else if (message.type === "error") {
          setError(message.text);
          if (message.fatal) {
            stopped = true;
            setConnection("missing");
          }
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setConnection("connecting");
        retry = setTimeout(connect, RECONNECT_MS);
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [code, name]);

  // Rejected-move messages fade after a moment; a missing room's error stays.
  useEffect(() => {
    if (!error || connection === "missing") return;
    const timer = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(timer);
  }, [error, connection]);

  const send = useCallback((message) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  return { state, connection, error, send };
}
