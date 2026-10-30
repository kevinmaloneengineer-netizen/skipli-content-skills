// Start the API (watch mode) and the Vite dev server together.
// Defaults to demo mode (GOCLAW_MOCK=1, STORE=memory) unless the env / deploy/.env says otherwise.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Read deploy/.env first (real env vars win), so its Firestore project and GoClaw token decide the mode.
const envFile = process.env.ENV_FILE ?? fileURLToPath(new URL("../../deploy/.env", import.meta.url));
if (existsSync(envFile)) {
  const before = { ...process.env };
  process.loadEnvFile(envFile);
  Object.assign(process.env, before);
}

const API_PORT = process.env.API_PORT ?? "3001";
const env = { ...process.env, PORT: API_PORT, API_PORT };
if (!env.FIREBASE_PROJECT_ID && !env.FIRESTORE_EMULATOR_HOST) env.STORE ??= "memory";
if (!env.GOCLAW_GATEWAY_TOKEN) env.GOCLAW_MOCK ??= "1";

const procs = [
  spawn("node", ["--watch", "server/index.mjs"], { env, stdio: "inherit" }),
  spawn("npx", ["vite"], { env, stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => { stop(); process.exitCode = code ?? 0; });
