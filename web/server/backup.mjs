// Daily backup of the database: every collection as one gzipped JSON file in the storage bucket
// (backups/YYYY-MM-DD.json.gz), the last BACKUP_KEEP_DAYS (14) kept. Restore with scripts/restore-backup.mjs.

import { writeFile, unlink, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

/**
 * @param {{ store, storage, dir: string, keepDays?: number, today?: string }} opts  dir: a local folder for the file
 * @returns {Promise<{ key: string, bytes: number, removed: number, counts: object }>}
 */
export async function runBackup({ store, storage, dir, keepDays = 14, today = new Date().toISOString().slice(0, 10) }) {
  if (!storage.remote) throw new Error("Chưa cấu hình lưu trữ (STORAGE_*), không có chỗ để sao lưu");
  const data = await store.exportAll();
  const body = gzipSync(JSON.stringify({ app: "skipli-content", at: new Date().toISOString(), data }));
  await mkdir(dir, { recursive: true });
  const key = `backups/${today}.json.gz`;
  const file = path.join(dir, `${today}.json.gz`);
  await writeFile(file, body);
  try {
    await storage.put(key, file);
  } finally {
    await unlink(file).catch(() => {});
  }
  // Older than keepDays: removed (the date is in the name).
  const cutoff = new Date(Date.parse(today) - keepDays * 86_400_000).toISOString().slice(0, 10);
  let removed = 0;
  for (const item of await storage.list("backups/")) {
    const day = item.key.match(/backups\/(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1];
    if (day && day < cutoff) {
      await storage.remove(item.key);
      removed++;
    }
  }
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  return { key, bytes: body.length, removed, counts };
}
