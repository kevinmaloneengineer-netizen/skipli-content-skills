import { test } from "node:test";
import assert from "node:assert/strict";
import { readMenu } from "../server/vision.mjs";

const photo = { data: Buffer.from("x"), mime: "image/jpeg" };
const answer = (text) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));

test("menu photo: a busy model is told apart from a photo with no dish", async () => {
  process.env.GEMINI_API_KEY ||= "test";
  assert.equal(await readMenu(photo, { fetchFn: async () => new Response("{}", { status: 503 }) }), null);
  assert.equal(await readMenu(photo, { fetchFn: answer("Không thấy món nào") }), "");
  assert.equal(await readMenu(photo, { fetchFn: answer("# Tacos\nAl Pastor - 3.25") }), "# Tacos\nAl Pastor - 3.25");
});

test("menu photo: Gemini busy → Groq reads the menu; a Gemini answer is never sent to Groq", async () => {
  process.env.GEMINI_API_KEY ||= "test";
  process.env.GROQ_API_KEY = "q";
  try {
    const groq = (content) => async (url) => (url.includes("generativelanguage") ? new Response("{}", { status: 503 }) : new Response(JSON.stringify({ choices: [{ message: { content } }] })));
    assert.equal(await readMenu(photo, { fetchFn: groq("# Tacos\nAl Pastor - 3.25") }), "# Tacos\nAl Pastor - 3.25");
    assert.equal(await readMenu(photo, { fetchFn: groq("Không thấy món nào") }), "");
    let calls = 0;
    assert.equal(await readMenu(photo, { fetchFn: async (url) => (calls++, url.includes("chat") ? assert.fail("Groq called") : answer("Không thấy món nào")()) }), "");
  } finally {
    delete process.env.GROQ_API_KEY;
  }
});
