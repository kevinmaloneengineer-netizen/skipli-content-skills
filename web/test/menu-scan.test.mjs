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
