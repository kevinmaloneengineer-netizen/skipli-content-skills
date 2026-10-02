import { randomUUID } from "node:crypto";

const ACTIVE = new Set(["queued", "running"]);

/**
 * Write-through cache over a persistence adapter (Firestore in production,
 * memory in tests).
 *
 * The UI polls every few seconds; serving those reads from memory keeps
 * Firestore usage to one write per state change instead of hundreds of reads
 * per minute. This assumes ONE backend process owns the data (the job queue
 * is in-process too) - run a single instance.
 *
 * @param {object} adapter  see ./memory.mjs for the contract
 * @param {{ templates?: object[], cacheSize?: number }} opts
 */
export async function openStore(adapter, { templates = [], cacheSize = 300 } = {}) {
  const now = () => new Date().toISOString();

  const jobs = await adapter.loadRecentJobs(cacheSize); // newest first
  // Active jobs older than the window still need to be recovered.
  for (const j of await adapter.loadActiveJobs()) {
    if (!jobs.some((x) => x.id === j.id)) jobs.push(j);
  }
  jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const stamp = now();
  await adapter.seedOnce(templates.map((t) => ({ id: randomUUID(), kind: "template", tags: [], ...t, createdAt: stamp, updatedAt: stamp })));
  const library = await adapter.loadLibrary(); // newest first

  function trim() {
    // Evict the oldest finished jobs; they stay readable through adapter.loadJob.
    while (jobs.length > cacheSize) {
      const i = jobs.findLastIndex((j) => !ACTIVE.has(j.status));
      if (i < 0) break;
      jobs.splice(i, 1);
    }
  }

  return {
    // ---- jobs ----
    /** Cached jobs, newest first. */
    listJobs: () => jobs,
    /** Sync lookup in the cache (queued/running jobs are always cached). */
    cachedJob: (id) => jobs.find((j) => j.id === id),
    async getJob(id) {
      return jobs.find((j) => j.id === id) ?? (await adapter.loadJob(id));
    },
    async addJob(job) {
      await adapter.saveJob(job);
      jobs.unshift(job);
      trim();
      return job;
    },
    async updateJob(id, patch) {
      const job = jobs.find((j) => j.id === id) ?? (await adapter.loadJob(id));
      if (!job) return undefined;
      Object.assign(job, patch);
      await adapter.saveJob(job);
      return job;
    },
    async deleteJob(id) {
      await adapter.deleteJob(id);
      const i = jobs.findIndex((j) => j.id === id);
      if (i >= 0) jobs.splice(i, 1);
    },

    // ---- library ----
    listLibrary: () => library,
    getItem: (id) => library.find((x) => x.id === id),
    async addItem(fields) {
      const item = { id: randomUUID(), ...fields, createdAt: now(), updatedAt: now() };
      await adapter.saveItem(item);
      library.unshift(item);
      return item;
    },
    async updateItem(id, patch) {
      const item = library.find((x) => x.id === id);
      if (!item) return undefined;
      const next = { ...item, ...patch, updatedAt: now() };
      await adapter.saveItem(next);
      Object.assign(item, next);
      return item;
    },
    async deleteItem(id) {
      await adapter.deleteItem(id);
      const i = library.findIndex((x) => x.id === id);
      if (i >= 0) library.splice(i, 1);
    },
  };
}
