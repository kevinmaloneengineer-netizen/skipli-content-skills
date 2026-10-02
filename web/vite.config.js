import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the React app on :3000 and proxies /api to the Node server on :3001.
// Prod: `npm run build` → client/dist, served by the Node server.
export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3000,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 3001}` },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
