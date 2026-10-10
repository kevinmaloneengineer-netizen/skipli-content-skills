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
