// Runs the 3D bot off the main thread, so the 3D view stays smooth while it thinks.
import { chooseMove } from "./bot.js";

self.onmessage = (event) => {
  const { requestId, snapshot, botId } = event.data;
  self.postMessage({ requestId, move: chooseMove(snapshot, botId) });
};
