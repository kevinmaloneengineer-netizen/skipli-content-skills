import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStorage, filesOf, presignGet } from "../server/storage.mjs";

test("presignGet matches AWS's own Signature V4 example", () => {
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html (example: GET test.txt)
  const url = presignGet({
    host: "examplebucket.s3.amazonaws.com", path: "/test.txt", region: "us-east-1", expires: 86400,
    accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", now: new Date("2013-05-24T00:00:00Z"),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test("storage: without settings it is local only; with settings files go up signed, come back, and are removed", async () => {
  assert.equal(createStorage({}).remote, false);
  const seen = [];
  const blobs = new Map();
  const server = createServer((req, res) => {
    let body = Buffer.alloc(0);
    req.on("data", (c) => (body = Buffer.concat([body, c])));
    req.on("end", () => {
      const key = decodeURIComponent(new URL(req.url, "http://x").pathname);
      seen.push({ method: req.method, key, auth: req.headers.authorization ?? "", query: req.url.includes("X-Amz-Signature") });
      if (req.method === "PUT") { blobs.set(key, body); return res.writeHead(200).end(); }
      if (req.method === "DELETE") { blobs.delete(key); return res.writeHead(204).end(); }
      if (blobs.has(key)) return res.writeHead(200).end(blobs.get(key));
      res.writeHead(404).end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const s = createStorage({ STORAGE_ENDPOINT: `http://127.0.0.1:${server.address().port}`, STORAGE_BUCKET: "skipli", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret" });
    assert.equal(s.remote, true);
    const dir = await mkdtemp(path.join(tmpdir(), "st-"));
    const src = path.join(dir, "a.mp4");
    await writeFile(src, "VIDEO");
    await s.put("videos/a.mp4", src);
    assert.deepEqual(seen[0].method, "PUT");
    assert.equal(seen[0].key, "/skipli/videos/a.mp4");
    assert.match(seen[0].auth, /^AWS4-HMAC-SHA256 Credential=id\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    assert.match(s.url("videos/a.mp4"), /\/skipli\/videos\/a\.mp4\?X-Amz-Algorithm=AWS4-HMAC-SHA256.*X-Amz-Signature=/);
    const back = path.join(dir, "back", "a.mp4");
    assert.equal(await s.get("videos/a.mp4", back), true);
    assert.equal(await readFile(back, "utf8"), "VIDEO");
    assert.equal(await s.get("videos/none.mp4", path.join(dir, "none.mp4")), false);
    await s.remove("videos/a.mp4");
    assert.equal(blobs.size, 0);
  } finally {
    server.close();
  }
});

test("filesOf: the video, clips and every drawn picture of a job, once each", () => {
  const keys = filesOf({ video: { file: "j.mp4", shots: [{ image: "j-s1.png" }] }, clips: [{ file: "j-clip1.mp4" }], images: { items: [{ file: "j-1.png" }] }, slides: [{ image: "j-1.png" }, { image: "j-r1.jpg" }] });
  assert.deepEqual(keys.sort(), ["images/j-1.png", "images/j-r1.jpg", "images/j-s1.png", "videos/j-clip1.mp4", "videos/j.mp4"]);
  assert.deepEqual(filesOf({}), []);
});

test("list reads every page; cleanUploads removes uploads older than 7 days, in storage and on disk", async () => {
  const { cleanUploads } = await import("../server/storage.mjs");
  const { utimes } = await import("node:fs/promises");
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const fresh = new Date().toISOString();
  const deleted = [];
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (req.method === "DELETE") { deleted.push(decodeURIComponent(u.pathname)); return res.writeHead(204).end(); }
    assert.match(req.headers.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
    const page2 = u.searchParams.get("continuation-token") === "next";
    const xml = page2
      ? `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>uploads/new.png</Key><LastModified>${fresh}</LastModified></Contents></ListBucketResult>`
      : `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next</NextContinuationToken><Contents><Key>uploads/old.mp4</Key><LastModified>${old}</LastModified></Contents></ListBucketResult>`;
    res.writeHead(200, { "Content-Type": "application/xml" }).end(xml);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const s = createStorage({ STORAGE_ENDPOINT: `127.0.0.1:${server.address().port}`.replace(/^/, "http://"), STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret" });
    const listed = await s.list("uploads/");
    assert.deepEqual(listed.map((o) => o.key), ["uploads/old.mp4", "uploads/new.png"]);

    const dir = await mkdtemp(path.join(tmpdir(), "up-"));
    await writeFile(path.join(dir, "stale.jpg"), "x");
    await writeFile(path.join(dir, "today.jpg"), "x");
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    await utimes(path.join(dir, "stale.jpg"), tenDaysAgo, tenDaysAgo);
    const removed = await cleanUploads({ storage: s, dir, days: 7 });
    assert.equal(removed, 2);
    assert.deepEqual(deleted, ["/b/uploads/old.mp4"]);
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual(await readdir(dir), ["today.jpg"]);
  } finally {
    server.close();
  }
});

test("an endpoint written without https:// still works", () => {
  const s = createStorage({ STORAGE_ENDPOINT: "s3.us-east-005.backblazeb2.com", STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret", STORAGE_REGION: "us-east-005" });
  assert.match(s.url("videos/a.mp4"), /^https:\/\/s3\.us-east-005\.backblazeb2\.com\/b\/videos\/a\.mp4\?.*us-east-005%2Fs3/);
});

test("a failed upload is tried again; a refused one (4xx) is not", async () => {
  let calls = 0;
  const flaky = async () => { calls++; if (calls === 1) throw new TypeError("fetch failed"); return { ok: true, status: 200 }; };
  const s = createStorage({ STORAGE_ENDPOINT: "https://s3.example.com", STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret" }, { fetchFn: flaky });
  const dir = await mkdtemp(path.join(tmpdir(), "retry-"));
  await writeFile(path.join(dir, "a.png"), "x");
  await s.put("images/a.png", path.join(dir, "a.png"));
  assert.equal(calls, 2);
  let refused = 0;
  const denied = createStorage({ STORAGE_ENDPOINT: "https://s3.example.com", STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "id", STORAGE_SECRET_ACCESS_KEY: "secret" }, { fetchFn: async () => { refused++; return { ok: false, status: 403 }; } });
  await assert.rejects(denied.put("images/a.png", path.join(dir, "a.png")), /403/);
  assert.equal(refused, 1);
});
