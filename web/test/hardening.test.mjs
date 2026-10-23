import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, safeFetch, UnsafeUrlError } from "../server/safeFetch.mjs";
import { imageKind } from "../server/video.mjs";
import { readSheet, zipUnpackedSize } from "../server/sales.mjs";
import { safeHref } from "../client/src/lib/safeUrl.js";

test("safeFetch: internal and private addresses are refused before any request", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.18.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "142.250.72.14", "2606:4700::6810:85e5"]) assert.equal(isPublicAddress(ip), true, ip);

  const asked = [];
  const fetchFn = async (url) => (asked.push(url), { status: 200, headers: { get: () => null } });
  const publicHost = async () => [{ address: "93.184.216.34" }];
  await assert.rejects(safeFetch("http://example.com/a.jpg", {}, { fetchFn, resolve: publicHost }), UnsafeUrlError); // https only
  await assert.rejects(safeFetch("https://goclaw/v1/agents", {}, { fetchFn, resolve: async () => [{ address: "172.18.0.4" }] }), UnsafeUrlError);
  await assert.rejects(safeFetch("https://127.0.0.1:9222/json", {}, { fetchFn }), UnsafeUrlError);
  assert.deepEqual(asked, []); // nothing was requested
  assert.equal((await safeFetch("https://cdn.example.com/a.jpg", {}, { fetchFn, resolve: publicHost })).status, 200);
});

test("safeFetch: a redirect into the internal network is not followed", async () => {
  const asked = [];
  const fetchFn = async (url) => {
    asked.push(url);
    return url.includes("cdn") ? { status: 302, headers: { get: () => "https://metadata.internal/latest" } } : { status: 200, headers: { get: () => null } };
  };
  const resolve = async (host) => [{ address: host === "metadata.internal" ? "169.254.169.254" : "93.184.216.34" }];
  await assert.rejects(safeFetch("https://cdn.example.com/x", {}, { fetchFn, resolve }), /không được phép/);
  assert.deepEqual(asked, ["https://cdn.example.com/x"]);
});

test("uploads: the bytes must match the picture type", () => {
  assert.equal(imageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), "image/png");
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(imageKind(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])), "image/webp");
  assert.equal(imageKind(Buffer.from("<svg onload=alert(1)>")), null);
});

test("sales file: a zip that unpacks too big is refused before it is read", () => {
  // One central-directory entry that claims 100 MB unpacked, and the end record pointing at it.
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt32LE(100 * 1024 * 1024, 24);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(4, 16); // the directory starts right after the 4-byte local header signature below
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), cd, end]);
  assert.equal(zipUnpackedSize(zip), 100 * 1024 * 1024);
  assert.throws(() => readSheet(zip), /quá lớn khi giải nén/);
});

test("links from scraped data: only http(s) becomes a link", () => {
  assert.equal(safeHref("https://www.facebook.com/reel/1"), "https://www.facebook.com/reel/1");
  assert.equal(safeHref("http://example.com"), "http://example.com");
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref(" data:text/html,<b>x</b>"), undefined);
  assert.equal(safeHref(undefined), undefined);
});
