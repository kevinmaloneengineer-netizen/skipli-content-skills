import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// styles.css writes dark mode once, as `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`.
// This copies each such block for the manual toggle (<html data-theme="dark">), so the two never drift apart.
const manualDarkTheme = {
  postcssPlugin: "manual-dark-theme",
  Once(root) {
    root.walkAtRules("media", (rule) => {
      if (!/prefers-color-scheme:\s*dark/.test(rule.params)) return;
      const copy = rule.clone();
      copy.walkRules((r) => {
        r.selector = r.selector.replaceAll(':root:not([data-theme="light"])', ':root[data-theme="dark"]');
      });
      rule.after(copy.nodes);
    });
  },
};

// Dev: Vite serves the React app on :3000 and proxies /api to the Node server on :3001.
// Prod: `npm run build` → client/dist, served by the Node server.
export default defineConfig({
  root: "client",
  plugins: [react()],
  css: { postcss: { plugins: [manualDarkTheme] } },
  server: {
    host: "127.0.0.1",
    port: 3000,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 3001}`, "/media": `http://127.0.0.1:${process.env.API_PORT ?? 3001}` },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
