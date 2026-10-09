import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import postcss from "postcss";

// styles.css writes dark mode once, as `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`.
// This copies each such block for the manual toggle (<html data-theme="dark">), so the two never drift apart.
// It is a Vite transform (not a css.postcss plugin): Vite 8 no longer runs inline PostCSS plugins.
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
const darkToggle = {
  name: "manual-dark-theme",
  enforce: "pre",
  async transform(code, id) {
    if (!/\.css($|\?)/.test(id) || !code.includes("prefers-color-scheme")) return null;
    return { code: (await postcss([manualDarkTheme]).process(code, { from: id })).css, map: null };
  },
};

// Dev: Vite serves the React app on :3000 and proxies /api to the Node server on :3001.
// Prod: `npm run build` → client/dist, served by the Node server.
export default defineConfig({
  root: "client",
  plugins: [react(), darkToggle],
  server: {
    host: "127.0.0.1",
    port: 3000,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 3001}`, "/media": `http://127.0.0.1:${process.env.API_PORT ?? 3001}` },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
