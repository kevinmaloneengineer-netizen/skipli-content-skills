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
    seen.push({ url, headers: init.headers, body: JSON.parse(init.body) });
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
    assert.equal(seen[0].headers["x-goog-api-key"], "test", "the key goes in a header");
    assert.doesNotMatch(seen[0].url, /key=/);
    delete process.env.GEMINI_API_KEY;
    assert.equal(await describePhoto(file, { fetchFn }), null, "no key, no call");
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test("vision: Gemini busy or silent → the Groq vision model answers; Groq refusing too gives null", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vis-"));
  const file = path.join(dir, "a.jpg");
  await writeFile(file, Buffer.from("JPGDATA"));
  const seen = [];
  const fetchFn = (groq) => async (url, init) => {
    seen.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (url.includes("generativelanguage")) return { ok: false, status: 503 };
    return groq ? { ok: true, json: async () => ({ choices: [{ message: { content: "<think>x</think>Tô gốm đen, phô mai trắng." } }] }) } : { ok: false, status: 429 };
  };
  process.env.GEMINI_API_KEY = "g";
  process.env.GROQ_API_KEY = "q";
  try {
    assert.equal(await describePhoto(file, { fetchFn: fetchFn(true) }), "Tô gốm đen, phô mai trắng.");
    const groq = seen.at(-1);
    assert.match(groq.url, /chat\/completions/);
    assert.equal(groq.headers.Authorization, "Bearer q");
    assert.equal(groq.body.messages[0].content[0].text, ASK);
    assert.equal(groq.body.messages[0].content[1].image_url.url, `data:image/jpeg;base64,${Buffer.from("JPGDATA").toString("base64")}`);
    assert.equal(await describePhoto(file, { fetchFn: fetchFn(false) }), null);
    delete process.env.GEMINI_API_KEY;
    seen.length = 0;
    assert.equal(await describePhoto(file, { fetchFn: fetchFn(true) }), "Tô gốm đen, phô mai trắng.", "only a Groq key still reads photos");
    assert.equal(seen.length, 1);
  } finally {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
  }
});
