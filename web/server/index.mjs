import { loadConfig } from "./config.mjs";
import { createApp } from "./app.mjs";
import { connectFirestore, firestoreAdapter } from "./store/firestore.mjs";
import { memoryAdapter } from "./store/memory.mjs";

const config = loadConfig();
const adapter =
  config.store === "memory"
    ? memoryAdapter()
    : firestoreAdapter(connectFirestore(config.firebase), config.firebase.prefix);

const { app } = await createApp(config, adapter);
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

// In-flight GoClaw calls cannot survive a restart; recover() marks them failed on next boot.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
