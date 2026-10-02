// Adapter contract tests. Always run against memory; also against Firestore
// when FIRESTORE_EMULATOR_HOST is set (npm run test:firestore).
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { memoryAdapter } from "../server/store/memory.mjs";
import { openStore } from "../server/store/index.mjs";

const adapters = [["memory", async () => memoryAdapter()]];
if (process.env.FIRESTORE_EMULATOR_HOST) {
  const { connectFirestore, firestoreAdapter } = await import("../server/store/firestore.mjs");
  const db = connectFirestore({ projectId: "demo-skipli-test" });
  // Fresh prefix per adapter instance = isolated collections, no cleanup needed.
  adapters.push(["firestore", async () => firestoreAdapter(db, `t${randomUUID().slice(0, 8)}_`)]);
}

const job = (id, createdAt, status = "done") => ({ id, type: "write", status, title: id, input: { topic: id, reference: undefined }, prompt: "p", result: null, error: null, createdAt });

for (const [name, make] of adapters) {
  describe(`${name} adapter`, () => {
    let a;
    before(async () => {
      a = await make();
    });

    test("jobs: save, load, recent order, active, delete", async () => {
      await a.saveJob(job("old", "2026-10-01T00:00:00.000Z", "queued"));
      await a.saveJob(job("mid", "2026-10-01T01:00:00.000Z"));
      await a.saveJob(job("new", "2026-10-01T02:00:00.000Z", "running"));
      assert.deepEqual((await a.loadRecentJobs(2)).map((j) => j.id), ["new", "mid"]);
      assert.deepEqual((await a.loadActiveJobs()).map((j) => j.id).sort(), ["new", "old"]);
      const loaded = await a.loadJob("mid");
      assert.equal(loaded.input.topic, "mid");
      assert.ok(!("reference" in loaded.input) || loaded.input.reference === undefined, "undefined fields are accepted");
      await a.saveJob({ ...loaded, status: "failed", error: "x" });
      assert.equal((await a.loadJob("mid")).status, "failed");
      await a.deleteJob("mid");
      assert.equal(await a.loadJob("mid"), undefined);
    });

    test("library: seedOnce is idempotent, save/delete", async () => {
      const t = { id: randomUUID(), kind: "template", title: "T", body: "B", tags: [], createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
      assert.equal(await a.seedOnce([t]), true);
      assert.equal(await a.seedOnce([{ ...t, id: randomUUID() }]), false);
      assert.equal((await a.loadLibrary()).length, 1);
      const s = { ...t, id: randomUUID(), kind: "saved", createdAt: "2026-10-02T00:00:00.000Z" };
      await a.saveItem(s);
      assert.deepEqual((await a.loadLibrary()).map((x) => x.kind), ["saved", "template"]);
      await a.deleteItem(s.id);
      assert.equal((await a.loadLibrary()).length, 1);
    });

    test("store cache: evicts finished jobs only and falls back to the adapter", async () => {
      const fresh = await make();
      for (let i = 0; i < 6; i++) await fresh.saveJob(job(`j${i}`, `2026-10-0${i + 1}T00:00:00.000Z`, i === 0 ? "queued" : "done"));
      const store = await openStore(fresh, { cacheSize: 3 });
      const ids = store.listJobs().map((j) => j.id);
      assert.deepEqual(ids, ["j5", "j4", "j3", "j0"], "recent window + old active job");
      await store.addJob(job("j6", "2026-10-07T00:00:00.000Z"));
      assert.ok(store.cachedJob("j0"), "active job never evicted");
      assert.equal(store.cachedJob("j3"), undefined, "oldest finished job evicted");
      assert.equal((await store.getJob("j3")).id, "j3", "still readable from the database");
      await store.updateJob("j1", { title: "updated" });
      assert.equal((await fresh.loadJob("j1")).title, "updated", "update of an uncached job is persisted");
    });
  });
}
