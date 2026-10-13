import { test } from "node:test";
import assert from "node:assert/strict";
import { currentWeather, weatherSentence } from "../server/weather.mjs";

const fake = (calls) => async (url) => {
  calls.push(url);
  if (url.includes("geocoding")) return { json: async () => ({ results: [{ name: "Hà Nội", admin1: "Hà Nội", country: "Việt Nam", latitude: 21, longitude: 105.8 }] }) };
  return { json: async () => ({ current: { temperature_2m: 27.4, relative_humidity_2m: 81, precipitation: 0.6, weather_code: 61 } }) };
};

test("weather: city looked up, current conditions read, in Vietnamese", async () => {
  const calls = [];
  const w = await currentWeather("Hà Nội", { fetchFn: fake(calls) });
  assert.deepEqual(w, { place: "Hà Nội, Việt Nam", temperature: 27, humidity: 81, rain: true, sky: "mưa nhẹ" });
  assert.match(calls[0], /name=H%C3%A0%20N%E1%BB%99i/);
  assert.equal(weatherSentence(w), "Thời tiết hiện tại ở Hà Nội, Việt Nam: mưa nhẹ, 27°C, độ ẩm 81%, đang mưa.");
});

test("weather: unknown city or empty name gives null, no call made", async () => {
  const calls = [];
  assert.equal(await currentWeather("", { fetchFn: fake(calls) }), null);
  assert.equal(await currentWeather("Thành phố không có", { fetchFn: async () => ({ json: async () => ({}) }) }), null);
  assert.equal(calls.length, 0);
});
