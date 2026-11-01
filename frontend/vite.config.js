import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api requests (including the online games' WebSockets) go to the FastAPI
// backend on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", ws: true },
    },
  },
});
