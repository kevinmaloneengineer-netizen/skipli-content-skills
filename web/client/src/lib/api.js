export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // Session expired or password changed: AuthGate shows the login page again.
  if (res.status === 401 && data.auth) window.dispatchEvent(new Event("auth-required"));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

/** A long video for the Cắt Reels tool: the raw file goes up as it is (the server checks size and length). */
export async function uploadVideo(file) {
  const res = await fetch("/api/uploads/video", { method: "POST", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.auth) window.dispatchEvent(new Event("auth-required"));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

/** The viewer's own audio as an MP3: purpose "voice" (at most 90 seconds) or "music" (any length, first minute kept). */
export async function uploadAudio(file, purpose = "voice") {
  const res = await fetch(`/api/uploads/audio?purpose=${purpose}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.auth) window.dispatchEvent(new Event("auth-required"));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}
