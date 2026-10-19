// Restore the database from a daily backup (server/backup.mjs).
//
//   node scripts/restore-backup.mjs backups/2026-10-18.json.gz            what is in it (writes nothing)
//   node scripts/restore-backup.mjs backups/2026-10-18.json.gz --confirm  write it back to Firestore
//
// The name can be a key in the storage bucket or a local .json.gz file. Documents in the backup overwrite
// the ones with the same id; documents made after the backup are left as they are. Stop the web server
// first, it keeps its own copy of the data in memory.

import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { loadConfig } from "../server/config.mjs";
import { createStorage } from "../server/storage.mjs";
import { connectFirestore } from "../server/store/firestore.mjs";

const [name, flag] = process.argv.slice(2);
if (!name) {
  console.error("Usage: node scripts/restore-backup.mjs <backups/YYYY-MM-DD.json.gz | file> [--confirm]");
  process.exit(1);
}
const config = loadConfig();

let file = name;
if (!existsSync(name)) {
  const storage = createStorage();
  if (!storage.remote) throw new Error("No local file by that name and no storage bucket configured (STORAGE_*)");
  file = path.join(mkdtempSync(path.join(tmpdir(), "restore-")), path.basename(name));
  if (!(await storage.get(name, file))) throw new Error(`Not found in the bucket: ${name}`);
}
const { at, data } = JSON.parse(gunzipSync(readFileSync(file)));
console.log(`Backup made ${at}:`);
for (const [collection, docs] of Object.entries(data)) console.log(`  ${collection}: ${docs.length}`);

if (flag !== "--confirm") {
  console.log("\nNothing written. Add --confirm to write these documents back to Firestore.");
  process.exit(0);
}
if (config.store !== "firestore") throw new Error("STORE=memory: nothing to restore into");
const db = connectFirestore(config.firebase);
let n = 0;
for (const [collection, docs] of Object.entries(data)) {
  const ref = db.collection(`${config.firebase.prefix}${collection}`);
  for (const { id, ...doc } of docs) {
    // Jobs, users… keep their id inside the document too; meta docs (app, settings) do not.
    await ref.doc(id).set(collection === "meta" ? doc : { id, ...doc });
    n++;
  }
}
console.log(`\nRestored ${n} documents. Start the web server again.`);
