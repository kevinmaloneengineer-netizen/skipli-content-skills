// In-memory persistence adapter: tests and `STORE=memory` demos. Data is lost on restart.
// Defines the adapter contract the Firestore adapter implements.

const clone = (x) => structuredClone(x);
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

export function memoryAdapter() {
  const jobs = new Map();
  const library = new Map();
  let seeded = false;

  return {
    async loadRecentJobs(limit) {
      return [...jobs.values()].sort(newestFirst).slice(0, limit).map(clone);
    },
    async loadActiveJobs() {
      return [...jobs.values()].filter((j) => j.status === "queued" || j.status === "running").map(clone);
    },
    async loadJob(id) {
      return jobs.has(id) ? clone(jobs.get(id)) : undefined;
    },
    async saveJob(job) {
      jobs.set(job.id, clone(job));
    },
    async deleteJob(id) {
      jobs.delete(id);
    },
    async loadLibrary() {
      return [...library.values()].sort(newestFirst).map(clone);
    },
    async saveItem(item) {
      library.set(item.id, clone(item));
    },
    async deleteItem(id) {
      library.delete(id);
    },
    /** Insert starter items exactly once per database. */
    async seedOnce(items) {
      if (seeded) return false;
      for (const item of items) library.set(item.id, clone(item));
      seeded = true;
      return true;
    },
  };
}
