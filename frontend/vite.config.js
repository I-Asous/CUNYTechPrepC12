import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api requests go to the FastAPI backend (not built yet) on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
