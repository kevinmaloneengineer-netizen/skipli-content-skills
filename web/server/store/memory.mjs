// In-memory persistence adapter: tests and `STORE=memory` demos. Data is lost on restart.
// Defines the adapter contract the Firestore adapter implements.

const clone = (x) => structuredClone(x);
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

export function memoryAdapter() {
  const jobs = new Map();
  const library = new Map();
  const feedback = [];
  const schedule = new Map();
  const watch = new Map();
  const users = new Map();
  const errors = [];
  const answers = []; // guests' answers to a shop's table survey
  let settings = {};
  let seeded = false;

  return {
    async loadUsers() {
      return [...users.values()].map(clone);
    },
    async saveUser(u) {
      users.set(u.id, clone(u));
    },
    async deleteUser(id) {
      users.delete(id);
    },
    async loadWatch() {
      return [...watch.values()].map(clone);
    },
    async saveWatch(w) {
      watch.set(w.id, clone(w));
    },
    async deleteWatch(id) {
      watch.delete(id);
    },
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
    async loadSchedule() {
      return [...schedule.values()].map(clone);
    },
    async saveSlot(slot) {
      schedule.set(slot.id, clone(slot));
    },
    async deleteSlot(id) {
      schedule.delete(id);
    },
    async saveFeedback(item) {
      feedback.push(clone(item));
    },
    /** Table survey answers: one survey's, newest first. */
    async loadAnswers(surveyId, limit = 2000) {
      return answers.filter((a) => a.surveyId === surveyId).sort(newestFirst).slice(0, limit).map(clone);
    },
    async saveAnswer(a) {
      answers.push(clone(a));
    },
    async deleteAnswers(surveyId) {
      for (let i = answers.length - 1; i >= 0; i--) if (answers[i].surveyId === surveyId) answers.splice(i, 1);
    },
    async loadSettings() {
      return clone(settings);
    },
    async saveSettings(next) {
      settings = clone(next);
    },
    async saveError(item) {
      errors.push(clone(item));
    },
    async loadErrors(limit) {
      return [...errors].sort(newestFirst).slice(0, limit).map(clone);
    },
    async deleteErrors() {
      errors.length = 0;
    },
    /** Everything, for a backup: { collection: [docs] }. */
    async exportAll() {
      const all = (m) => [...m.values()].map(clone);
      return { jobs: all(jobs), library: all(library), schedule: all(schedule), watch: all(watch), users: all(users), feedback: feedback.map(clone), errors: errors.map(clone), answers: answers.map(clone), meta: [{ id: "settings", ...clone(settings) }] };
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
