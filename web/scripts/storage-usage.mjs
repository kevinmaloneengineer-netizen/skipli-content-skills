// How much of the object store the app uses, by folder: node scripts/storage-usage.mjs (from web/).
import { createStorage } from "../server/storage.mjs";

process.loadEnvFile(new URL("../../deploy/.env", import.meta.url));
const storage = createStorage();
if (!storage.remote) {
  console.log("Chưa cấu hình kho lưu trữ (STORAGE_* trong deploy/.env).");
  process.exit(0);
}
const all = await storage.list("");
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const by = {};
for (const o of all) {
  const top = o.key.split("/")[0];
  (by[top] ??= { files: 0, bytes: 0 }).files++;
  by[top].bytes += o.size;
}
for (const [dir, x] of Object.entries(by).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`${dir.padEnd(10)} ${String(x.files).padStart(5)} file  ${mb(x.bytes)}`);
const total = all.reduce((a, o) => a + o.size, 0);
console.log(`${"Tổng".padEnd(10)} ${String(all.length).padStart(5)} file  ${mb(total)}  (${((total / (10 * 1073741824)) * 100).toFixed(2)}% của 10 GB miễn phí)`);
