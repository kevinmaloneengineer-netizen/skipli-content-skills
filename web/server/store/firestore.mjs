import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Connect with firebase-admin. Credentials, in order:
 *  - FIRESTORE_EMULATOR_HOST set → emulator (no credentials needed)
 *  - FIREBASE_SERVICE_ACCOUNT = service-account JSON (string)
 *  - GOOGLE_APPLICATION_CREDENTIALS = path to that JSON / ADC on GCP
 */
export function connectFirestore({ projectId, serviceAccount, databaseId }) {
  const app =
    getApps()[0] ??
    initializeApp({
      projectId,
      ...(serviceAccount && { credential: cert(JSON.parse(serviceAccount)) }),
    });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/**
 * Firestore persistence adapter (contract: ./memory.mjs).
 *
 * Collections (prefix lets this share a project with the main Skipli app):
 *   <prefix>jobs/{id}      one agent run
 *   <prefix>library/{id}   template or saved post
 *   <prefix>meta/app       { seeded: true }
 * Only single-field queries are used, so no composite index is needed.
 * Clients never touch Firestore directly - see deploy/firebase/firestore.rules.
 */
export function firestoreAdapter(db, prefix = "") {
  const jobs = db.collection(`${prefix}jobs`);
  const library = db.collection(`${prefix}library`);
  const meta = db.collection(`${prefix}meta`).doc("app");
  const feedback = db.collection(`${prefix}feedback`);
  const data = (snap) => snap.docs.map((d) => d.data());

  return {
    async loadRecentJobs(limit) {
      return data(await jobs.orderBy("createdAt", "desc").limit(limit).get());
    },
    async loadActiveJobs() {
      return data(await jobs.where("status", "in", ["queued", "running"]).get());
    },
    async loadJob(id) {
      const snap = await jobs.doc(id).get();
      return snap.exists ? snap.data() : undefined;
    },
    async saveJob(job) {
      await jobs.doc(job.id).set(job);
    },
    async deleteJob(id) {
      await jobs.doc(id).delete();
    },
    async loadLibrary() {
      return data(await library.orderBy("createdAt", "desc").get());
    },
    async saveItem(item) {
      await library.doc(item.id).set(item);
    },
    async deleteItem(id) {
      await library.doc(id).delete();
    },
    async saveFeedback(item) {
      await feedback.doc(item.id).set(item);
    },
    async seedOnce(items) {
      return db.runTransaction(async (tx) => {
        if ((await tx.get(meta)).get("seeded")) return false;
        for (const item of items) tx.set(library.doc(item.id), item);
        tx.set(meta, { seeded: true, seededAt: new Date().toISOString() });
        return true;
      });
    },
  };
}
