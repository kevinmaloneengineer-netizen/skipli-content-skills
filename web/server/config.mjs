import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = path.resolve(here, "..");

/** Load deploy/.env (or ENV_FILE) for local dev; real env vars win. */
function loadEnvFile() {
  const file = process.env.ENV_FILE ?? path.resolve(WEB_ROOT, "../deploy/.env");
  if (!existsSync(file)) return;
  const before = { ...process.env };
  process.loadEnvFile(file);
  // loadEnvFile overwrites; restore anything already set by the real environment.
  for (const [k, v] of Object.entries(before)) process.env[k] = v;
}

function int(name, fallback, min, max) {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function loadConfig() {
  loadEnvFile();
  const env = process.env;
  const mock = env.GOCLAW_MOCK === "1";
  const config = {
    port: int("PORT", 3000, 1, 65535),
    host: env.HOST ?? "127.0.0.1",
    store: env.STORE ?? (env.FIREBASE_PROJECT_ID || env.FIRESTORE_EMULATOR_HOST ? "firestore" : ""),
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || "demo-skipli",
      serviceAccount: env.FIREBASE_SERVICE_ACCOUNT || "",
      databaseId: env.FIRESTORE_DATABASE_ID || "",
      prefix: env.FIRESTORE_PREFIX ?? "content_",
    },
    appPassword: env.APP_PASSWORD ?? "",
    accounts: env.ACCOUNTS === "1", // one login per customer (server/accounts.mjs)
    goclaw: {
      url: (env.GOCLAW_URL ?? "http://localhost:18790").replace(/\/+$/, ""),
      token: env.GOCLAW_GATEWAY_TOKEN ?? "",
      userId: env.GOCLAW_USER_ID || "system",
      mock,
      // Mock delay lets the UI be tested with realistic queued/running states.
      mockDelayMs: int("GOCLAW_MOCK_DELAY_MS", 4000, 0, 600_000),
    },
    facebook: {
      apifyToken: env.APIFY_TOKEN || "",
      actor: env.APIFY_FB_REELS_ACTOR || "apify~facebook-reels-scraper",
      cacheHours: int("REEL_LIST_CACHE_HOURS", 6, 0, 168),
    },
    agents: {
      scout: env.AGENT_SCOUT || "content-scout",
      writer: env.AGENT_WRITER || "content-writer",
    },
    video: {
      dataDir: env.DATA_DIR || path.join(WEB_ROOT, ".data"),
      timeoutMs: int("VIDEO_TIMEOUT_MIN", 90, 5, 360) * 60_000,
      mock,
    },
    jobs: {
      concurrency: int("JOB_CONCURRENCY", 1, 1, 8),
      timeoutMs: int("JOB_TIMEOUT_MIN", 20, 1, 120) * 60_000,
    },
  };
  if (config.store !== "firestore" && config.store !== "memory") {
    throw new Error("Set FIREBASE_PROJECT_ID (Firestore) or STORE=memory (demo, data lost on restart).");
  }
  if (!mock && !config.goclaw.token) {
    throw new Error("GOCLAW_GATEWAY_TOKEN is not set (deploy/.env or env). Use GOCLAW_MOCK=1 to run without GoClaw.");
  }
  return config;
}
