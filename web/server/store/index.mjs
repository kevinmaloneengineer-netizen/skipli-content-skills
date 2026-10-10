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
export async function openStore(adapter, { templates = [], cacheSize = 1000 } = {}) {
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
  const schedule = await adapter.loadSchedule(); // small: one row per planned post
  const watch = (await adapter.loadWatch?.()) ?? []; // competitor channels to re-check
  const users = (await adapter.loadUsers?.()) ?? []; // customer accounts (ACCOUNTS=1)

  function trim() {
    // Evict the oldest finished jobs; they stay readable through adapter.loadJob.
    while (jobs.length > cacheSize) {
      const i = jobs.findLastIndex((j) => !ACTIVE.has(j.status));
      if (i < 0) break;
      jobs.splice(i, 1);
    }
  }

  return {
    // ---- accounts ----
    listUsers: () => [...users].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    getUser: (id) => users.find((u) => u.id === id),
    userByEmail: (email) => users.find((u) => u.email === String(email ?? "").trim().toLowerCase()),
    async addUser(u) {
      const user = { id: randomUUID(), createdAt: now(), disabled: false, ...u, email: u.email.trim().toLowerCase() };
      await adapter.saveUser(user);
      users.push(user);
      return user;
    },
    async updateUser(id, patch) {
      const user = users.find((u) => u.id === id);
      if (!user) return undefined;
      Object.assign(user, patch, { updatedAt: now() });
      await adapter.saveUser(user);
      return user;
    },

    // ---- watched competitor channels ----
    listWatch: () => [...watch].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    getWatch: (id) => watch.find((w) => w.id === id),
    async addWatch(w) {
      const item = { id: randomUUID(), createdAt: now(), lastCheckedAt: null, knownIds: [], ...w };
      await adapter.saveWatch(item);
      watch.push(item);
      return item;
    },
    async updateWatch(id, patch) {
      const item = watch.find((w) => w.id === id);
      if (!item) return undefined;
      Object.assign(item, patch);
      await adapter.saveWatch(item);
      return item;
    },
    async deleteWatch(id) {
      await adapter.deleteWatch(id);
      const i = watch.findIndex((w) => w.id === id);
      if (i >= 0) watch.splice(i, 1);
    },
    listSchedule(from, to) {
      return schedule.filter((s) => (!from || s.at >= from) && (!to || s.at < to)).sort((a, b) => a.at.localeCompare(b.at));
    },
    getSlot(id) {
      return schedule.find((s) => s.id === id);
    },
    async addSlots(list) {
      const stamp = now();
      const added = list.map((x) => ({ id: randomUUID(), status: "planned", ...x, createdAt: stamp, updatedAt: stamp }));
      for (const slot of added) {
        await adapter.saveSlot(slot);
        schedule.push(slot);
      }
      return added;
    },
    async updateSlot(id, patch) {
      const slot = schedule.find((s) => s.id === id);
      if (!slot) return undefined;
      Object.assign(slot, patch, { updatedAt: now() });
      await adapter.saveSlot(slot);
      return slot;
    },
    async deleteSlot(id) {
      const i = schedule.findIndex((s) => s.id === id);
      if (i >= 0) schedule.splice(i, 1);
      await adapter.deleteSlot(id);
    },

    /** Store a feedback message (write-only: read them in the Firestore console). */
    async addFeedback({ message, contact, page }) {
      const item = { id: randomUUID(), message, contact, page, createdAt: now() };
      await adapter.saveFeedback(item);
      return item;
    },

    /** Usage numbers for the footer, over the cached recent jobs + the whole library. */
    stats(mine = () => true) {
      const done = jobs.filter((j) => j.status === "done" && mine(j));
      const scanned = { "fb-reels": (j) => (j.input?.mode === "channel" ? j.input.depth ?? 10 : 1), fanpage: () => 100, clone: (j) => (j.input?.url ? 30 : 0) };
      return {
        runs: done.length,
        saved: library.filter((x) => x.kind === "saved" && mine(x)).length,
        templates: library.filter((x) => x.kind === "template").length,
        reels: done.reduce((n, j) => n + (scanned[j.type]?.(j) ?? 0), 0),
        byType: Object.fromEntries([...new Set(jobs.filter(mine).map((j) => j.type))].map((t) => [t, jobs.filter((j) => j.type === t && mine(j)).length])),
      };
    },

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
