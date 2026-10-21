import assert from "node:assert/strict";
import test from "node:test";
import { buildJob } from "../server/prompts.mjs";
import { coordsIn, isMapsLink, MapLinkError, placeFromLink, worldPx } from "../server/sources/osm.mjs";

const PLACE = "https://www.google.com/maps/place/Ph%E1%BB%9F+H%C3%B2a+Pasteur/@10.7869,106.6865,17z/data=!3m1!4b1!4m6!3m5!1s0x317528d1:0x2a!8m2!3d10.7868014!4d106.689046!16s%2Fg%2F1tdx";

test("map: the exact pin of a Google Maps link, never the centre of the view", () => {
  assert.deepEqual(coordsIn(PLACE), { lat: 10.7868014, lon: 106.689046 }); // !3d…!4d…, not @10.7869,106.6865
  assert.equal(coordsIn("https://www.google.com/maps/place/Ph%E1%BB%9F/@10.7869,106.6865,17z"), null);
  assert.deepEqual(coordsIn("https://maps.google.com/?q=10.78178,106.70545"), { lat: 10.78178, lon: 106.70545 });
  assert.deepEqual(coordsIn("https://www.google.com/maps/place/21.0180504,105.8538843"), { lat: 21.0180504, lon: 105.8538843 });
  assert.ok(isMapsLink("https://maps.app.goo.gl/AbC123"));
  assert.ok(!isMapsLink("https://example.com/maps/x"));
});

test("map: a short link is followed to the full one; no pin → a message for the user", async () => {
  // Redirects are followed by hand, one hop at a time, and only on Google's hosts.
  const hop = (to) => ({ status: 302, headers: { get: () => to } });
  const fetchFn = async (url) => (url.includes("good") ? hop(PLACE) : url.includes("evil") ? hop("http://chrome:9222/json/version") : url.includes("view") ? hop("https://www.google.com/maps/@10.8,106.7,14z") : { status: 200, headers: { get: () => null } });
  assert.deepEqual(await placeFromLink("https://maps.app.goo.gl/good", { fetchFn }), { lat: 10.7868014, lon: 106.689046 });
  await assert.rejects(placeFromLink("https://maps.app.goo.gl/view", { fetchFn }), MapLinkError);
  const asked = [];
  await assert.rejects(placeFromLink("https://maps.app.goo.gl/evil", { fetchFn: async (u) => (asked.push(u), fetchFn(u)) }), MapLinkError);
  assert.deepEqual(asked, ["https://maps.app.goo.gl/evil"]); // the redirect into our own network is never followed
  assert.ok(!isMapsLink("https://maps.google.com.attacker.io/x"));
  await assert.rejects(placeFromLink("12 Lê Thánh Tôn", { fetchFn }), /không phải link Google Maps/);
  assert.deepEqual(await placeFromLink(PLACE, { fetchFn: () => assert.fail("a full link is read as it is") }), { lat: 10.7868014, lon: 106.689046 });
  assert.deepEqual(worldPx({ lat: 0, lon: 0 }, 1), [256, 256]);
});

test("map: the Chỉ đường template needs the restaurant's Google Maps link", () => {
  const has = { hasUpload: () => true };
  assert.throws(() => buildJob("video", { mode: "slideshow", layout: "map", topic: "Pho restaurant", address: "12 Lê Thánh Tôn" }, has), /link Google Maps/);
  assert.equal(buildJob("video", { mode: "slideshow", layout: "map", topic: "Pho restaurant", mapLink: PLACE }, has).input.mapLink, PLACE);
  assert.equal(buildJob("video", { mode: "slideshow", layout: "collage", topic: "Pho restaurant", mapLink: PLACE }, has).input.mapLink, undefined);
});
