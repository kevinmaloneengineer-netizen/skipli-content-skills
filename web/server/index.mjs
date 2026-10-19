import { loadConfig } from "./config.mjs";
import { createApp } from "./app.mjs";
import { connectFirestore, firestoreAdapter } from "./store/firestore.mjs";
import { memoryAdapter } from "./store/memory.mjs";

const config = loadConfig();
const adapter =
  config.store === "memory"
    ? memoryAdapter()
    : firestoreAdapter(connectFirestore(config.firebase), config.firebase.prefix);

const { app, runner, errors } = await createApp(config, adapter);
const server = app.listen(config.port, config.host, () => {
  const mode = [
    config.goclaw.mock ? "GOCLAW_MOCK=1" : `GoClaw ${config.goclaw.url}`,
    config.store === "memory" ? "STORE=memory" : `Firestore ${config.firebase.projectId}${process.env.FIRESTORE_EMULATOR_HOST ? " (emulator)" : ""}`,
  ].join(" · ");
  console.log(`Skipli Content API: http://${config.host}:${config.port}  (${mode})`);
  if (config.host !== "127.0.0.1" && config.host !== "localhost" && !config.appPassword) {
    console.warn("WARNING: listening beyond localhost without APP_PASSWORD - anyone who can reach it can spend model quota.");
  }
});

// Crashes the code did not catch go to the error log (admin page, ERROR_WEBHOOK_URL) instead of vanishing.
process.on("unhandledRejection", (e) => {
  console.error("unhandledRejection:", e);
  errors.record({ source: "server", message: `unhandledRejection: ${e?.message ?? e}`, stack: e?.stack });
});
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e);
  errors.record({ source: "server", message: `uncaughtException: ${e?.message ?? e}`, stack: e?.stack }).finally(() => process.exit(1));
});

// Shutdown: stop taking requests and new jobs, let the running ones finish (SHUTDOWN_WAIT_SEC, 25 s).
// A job still running when time is up starts over once on the next boot (see recover()).
let closing = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    if (closing) process.exit(0); // a second Ctrl+C quits at once
    closing = true;
    server.close();
    server.closeIdleConnections();
    const wait = (Number(process.env.SHUTDOWN_WAIT_SEC) || 25) * 1000;
    console.log(`shutting down: waiting up to ${wait / 1000}s for running jobs (Ctrl+C again to quit now)`);
    const left = await runner.drain(wait);
    if (left) console.log(`shutting down: ${left} job(s) still running, they start over on the next boot`);
    process.exit(0);
  });
}
