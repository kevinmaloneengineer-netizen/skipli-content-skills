// Where finished files live. Jobs still work on the local disk (ffmpeg, the GPU worker and the Python
// scripts read and write files there); once a job is done its files are copied to object storage, and
// the media routes send viewers there when this server does not have the file. Cloudflare R2 is the
// target (no fee for downloads), but any S3-compatible store works.
//
// deploy/.env: STORAGE_ENDPOINT (https://<account id>.r2.cloudflarestorage.com), STORAGE_BUCKET,
// STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_REGION (R2: "auto"). Without them the
// files stay on this disk only, as before.

import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
// RFC 3986 encoding, as S3 signs it: "/" kept in paths only.
const enc = (s, slash = false) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(slash ? /%2F/g : /$^/, "/");

/** SigV4 signing key and signature of a string to sign. */
function sign(secret, date, region, toSign) {
  const k = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), "s3"), "aws4_request");
  return createHmac("sha256", k).update(toSign).digest("hex");
}

/**
 * A presigned GET URL (AWS Signature Version 4, query string). Exported for the test against AWS's own
 * example; `now` is a Date.
 */
export function presignGet({ host, path: keyPath, accessKeyId, secretAccessKey, region, expires, now = new Date(), protocol = "https" }) {
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amz.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const query = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${accessKeyId}/${scope}`, "X-Amz-Date": amz, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" };
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join("&");
  const canonical = ["GET", enc(keyPath, true), qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha256(canonical)].join("\n");
  return `${protocol}://${host}${enc(keyPath, true)}?${qs}&X-Amz-Signature=${sign(secretAccessKey, date, region, toSign)}`;
}

/** Headers for a signed request with a body (PUT, DELETE) using the Authorization header. */
function signedHeaders({ method, host, path: keyPath, query = "", body, type, accessKeyId, secretAccessKey, region, now = new Date() }) {
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amz.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const payload = sha256(body ?? "");
  const headers = { host, "x-amz-content-sha256": payload, "x-amz-date": amz, ...(type ? { "content-type": type } : {}) };
  const names = Object.keys(headers).sort();
  const canonical = [method, enc(keyPath, true), query, ...names.map((n) => `${n}:${headers[n]}`), "", names.join(";"), payload].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha256(canonical)].join("\n");
  const { host: _h, ...send } = headers;
  return { ...send, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sign(secretAccessKey, date, region, toSign)}` };
}

const TYPES = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".json": "application/json" };

/** @returns {{ remote: boolean, put, url, get, remove }} */
export function createStorage(env = process.env, { fetchFn = fetch } = {}) {
  const { STORAGE_ENDPOINT: endpoint, STORAGE_BUCKET: bucket, STORAGE_ACCESS_KEY_ID: accessKeyId, STORAGE_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    // Local only: the disk is the store.
    return { remote: false, put: async () => false, url: () => null, get: async () => false, remove: async () => {}, list: async () => [] };
  }
  const base = new URL(/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`); // "s3.…backblazeb2.com" works too
  const host = base.host;
  const protocol = base.protocol.replace(":", "");
  const region = env.STORAGE_REGION || "auto";
  const keyPath = (key) => `/${bucket}/${key}`; // path-style: works on R2 and every S3-compatible store
  const auth = { accessKeyId, secretAccessKey, region };
  // A network hiccup or a 5xx from the store is tried again (3 tries, 1 s then 2 s apart); a 4xx is not.
  const call = async (method, key, body, type) => {
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await fetchFn(`${protocol}://${host}${enc(keyPath(key), true)}`, { method, body, headers: signedHeaders({ method, host, path: keyPath(key), body, type, ...auth }) });
      } catch (e) {
        if (attempt >= 3) throw new Error(`Lưu trữ không phản hồi khi ${method} ${key}: ${e.cause?.code ?? e.message}`);
      }
      if (res && (res.ok || (method === "DELETE" && res.status === 404))) return res;
      if (res && (res.status < 500 || attempt >= 3)) throw new Error(`Lưu trữ lỗi ${res.status} khi ${method} ${key}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  };

  return {
    remote: true,
    /** Copy a local file to `key` (e.g. "videos/<job>.mp4"). */
    async put(key, file) {
      await call("PUT", key, await readFile(file), TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
      return true;
    },
    /** A link the browser opens right away; short-lived so a copied link soon stops working. */
    url: (key, seconds = 15 * 60) => presignGet({ host, protocol, path: keyPath(key), expires: seconds, ...auth }),
    /** Bring `key` back to a local file (e.g. an upload needed again for a retry); false when it is not there. */
    async get(key, dest) {
      const res = await fetchFn(presignGet({ host, protocol, path: keyPath(key), expires: 300, ...auth }));
      if (!res.ok) return false;
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return true;
    },
    async remove(key) {
      await call("DELETE", key);
    },
    /** Every object under `prefix`, with when it was last written (ListObjectsV2, page by page). */
    async list(prefix) {
      const out = [];
      let token = "";
      do {
        const q = { "list-type": "2", ...(prefix ? { prefix } : {}), ...(token ? { "continuation-token": token } : {}) }; // an empty prefix= breaks the signature on B2
        const query = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&");
        const p = `/${bucket}`;
        const res = await fetchFn(`${protocol}://${host}${p}?${query}`, { headers: signedHeaders({ method: "GET", host, path: p, query, ...auth }) });
        if (!res.ok) throw new Error(`Lưu trữ lỗi ${res.status} khi liệt kê ${prefix}`);
        const xml = await res.text();
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
          const modified = m[1].match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
          const size = Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
          if (key) out.push({ key: key.replace(/&amp;/g, "&"), modified: modified ? Date.parse(modified) : 0, size });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? "") : "";
      } while (token);
      return out;
    },
  };
}

/** Every file a job made, as storage keys: the video, the cut or dubbed clips, the drawn pictures. */
export function filesOf(job) {
  const out = new Set();
  if (job?.video?.file) out.add(`videos/${job.video.file}`);
  for (const c of job?.clips ?? []) if (c.file) out.add(`videos/${c.file}`);
  for (const x of job?.images?.items ?? []) if (x.file) out.add(`images/${x.file}`);
  for (const f of [job?.photos?.original, job?.photos?.fixed, ...(job?.photos?.items ?? []).map((x) => x.file)]) if (f) out.add(`images/${f}`);
  for (const x of [...(job?.slides ?? []), ...(job?.video?.shots ?? [])]) if (x.image) out.add(`images/${x.image}`);
  return [...out];
}

/**
 * Uploads (the photos, videos and audio people send) are only needed to make a video and to retry it:
 * delete the ones older than `days`, in storage and on this disk. Returns how many were removed.
 */
export async function cleanUploads({ storage, dir, days = 7, now = Date.now() }) {
  const { readdir, stat, rm } = await import("node:fs/promises");
  const cutoff = now - days * 86_400_000;
  let removed = 0;
  for (const o of await storage.list("uploads/")) {
    if (o.modified && o.modified < cutoff) {
      await storage.remove(o.key).catch(() => {});
      removed++;
    }
  }
  for (const name of await readdir(dir).catch(() => [])) {
    const file = path.join(dir, name);
    const info = await stat(file).catch(() => null);
    if (info?.isFile() && info.mtimeMs < cutoff) {
      await rm(file, { force: true });
      removed++;
    }
  }
  return removed;
}
