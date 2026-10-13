import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ASK, describePhoto } from "../server/vision.mjs";

test("vision: the photo goes to Gemini as an image with the no-name question; no key gives null", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vis-"));
  const file = path.join(dir, "a.png");
  await writeFile(file, Buffer.from("PNGDATA"));
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Tô nước nâu, rau xanh, miếng đỏ hồng." }] } }] }) };
  };
  process.env.GEMINI_API_KEY = "test";
  try {
    assert.equal(await describePhoto(file, { fetchFn }), "Tô nước nâu, rau xanh, miếng đỏ hồng.");
    const parts = seen[0].body.contents[0].parts;
    assert.equal(parts[0].inline_data.mime_type, "image/png");
    assert.equal(parts[0].inline_data.data, Buffer.from("PNGDATA").toString("base64"));
    assert.equal(parts[1].text, ASK);
    assert.match(seen[0].url, /generativelanguage/);
    delete process.env.GEMINI_API_KEY;
    assert.equal(await describePhoto(file, { fetchFn }), null, "no key, no call");
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});
