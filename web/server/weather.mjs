// Today's weather in a city for the "Thời tiết thành bài đăng" skill. Open-Meteo is free and needs no key:
// the city is looked up by name, then the current conditions are read at its coordinates.

const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

// WMO weather codes, in Vietnamese.
const SKY = {
  0: "trời quang", 1: "gần như quang mây", 2: "ít mây", 3: "nhiều mây", 45: "sương mù", 48: "sương mù đọng",
  51: "mưa phùn nhẹ", 53: "mưa phùn", 55: "mưa phùn nặng", 61: "mưa nhẹ", 63: "mưa vừa", 65: "mưa to",
  80: "mưa rào nhẹ", 81: "mưa rào", 82: "mưa rào to", 95: "dông", 96: "dông kèm mưa đá", 99: "dông mạnh",
};

/** @returns {Promise<null | { place, temperature, humidity, rain, sky }>} null when the city or the forecast is not found */
export async function currentWeather(city, { fetchFn = fetch, signal } = {}) {
  const name = String(city ?? "").trim();
  if (!name) return null;
  const geo = await (await fetchFn(`${GEO}?name=${encodeURIComponent(name)}&count=1&language=vi`, { signal })).json();
  const place = geo.results?.[0];
  if (!place) return null;
  const url = `${FORECAST}?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto`;
  const now = (await (await fetchFn(url, { signal })).json()).current;
  if (!now) return null;
  return {
    place: [place.name, place.admin1, place.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", "),
    us: place.country_code === "US",
    temperature: Math.round(now.temperature_2m),
    humidity: Math.round(now.relative_humidity_2m),
    rain: now.precipitation > 0,
    sky: SKY[now.weather_code] ?? "thời tiết thay đổi",
  };
}

/** The facts the post may use, one sentence: the model may not add anything to them. */
export const weatherSentence = (w) => `Thời tiết hiện tại ở ${w.place}: ${w.sky}, ${w.us ? `${Math.round((w.temperature * 9) / 5 + 32)}°F` : `${w.temperature}°C`}, độ ẩm ${w.humidity}%${w.rain ? ", đang mưa" : ""}.`;
