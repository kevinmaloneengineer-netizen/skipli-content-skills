import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { startTranslator } from "./lib/i18n.js";

// Apply a saved light/dark choice before the first paint (no inline script: the CSP forbids it).
try {
  const theme = localStorage.getItem("theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  /* storage blocked: follow the system setting */
}

// Browser errors go to the server's error log (the admin sees them); a few at most per page load.
let reported = 0;
function report(message, stack) {
  if (reported++ >= 5 || !message) return;
  const body = JSON.stringify({ message: String(message).slice(0, 500), stack: String(stack ?? "").slice(0, 4000), path: location.pathname });
  fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
window.addEventListener("error", (e) => report(e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => report(`Unhandled: ${e.reason?.message ?? e.reason}`, e.reason?.stack));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
startTranslator(); // English UI when chosen (lib/i18n.js)
