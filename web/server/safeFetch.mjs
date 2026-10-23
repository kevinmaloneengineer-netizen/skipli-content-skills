// Fetching a URL that came from outside (a scraped post's picture or video link): only https, only hosts
// that resolve to public addresses, and every redirect checked the same way. Without this, a post whose
// image URL points at http://goclaw:18790 or http://chrome:9222 makes the server call its own network.
// (The address is checked when resolved; a host that changes its DNS between the check and the request
// is not covered.)

import { lookup } from "node:dns/promises";
import net from "node:net";

const v4 = (ip) => ip.split(".").map(Number);

/** True for an address on the internet; false for loopback, private, link-local, CGNAT, multicast and the like. */
export function isPublicAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = v4(ip);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith("ff") || s.startsWith("2001:db8"));
  }
  return false;
}

export class UnsafeUrlError extends Error {}

/** fetch(), refused before any request when the URL (or a redirect) is not https on a public host. */
export async function safeFetch(url, init = {}, { fetchFn = fetch, resolve = (host) => lookup(host, { all: true }), maxHops = 3 } = {}) {
  let current = String(url ?? "");
  for (let hop = 0; hop <= maxHops; hop++) {
    let u;
    try {
      u = new URL(current);
    } catch {
      throw new UnsafeUrlError("Đường dẫn không hợp lệ");
    }
    if (u.protocol !== "https:") throw new UnsafeUrlError("Chỉ tải qua https");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const addrs = net.isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
    if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) throw new UnsafeUrlError("Địa chỉ không được phép");
    const res = await fetchFn(current, { ...init, redirect: "manual" });
    const to = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!to) return res;
    current = new URL(to, current).href;
  }
  throw new UnsafeUrlError("Chuyển hướng quá nhiều lần");
}
