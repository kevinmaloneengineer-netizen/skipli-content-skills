#!/usr/bin/env python3
"""Find the most-engaged Threads posts for keywords and/or profiles.

No login, no API key: Threads serves server-rendered post data to Meta's
link-preview crawler. Each keyword search returns ~20-30 posts ("Top" tab),
each profile ~10 most recent posts.

Outputs a single JSON object on stdout:
  {"ok": true, "scanned": N, "count": M, "posts": [{"rank", "url", "author", "text", "likes", ...}]}
  {"ok": false, "error": "..."}

Usage:
  python3 threads_scan.py --search "bán hàng online" --search "kinh doanh online" [--days 30] [--limit 20]
  python3 threads_scan.py --profile @zuck --profile https://www.threads.com/@mosseri
  python3 threads_scan.py --search "skincare" --recent       # newest posts instead of Top
"""

import argparse
import concurrent.futures
import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "facebookexternalhit/1.1",
    "Accept": "text/html",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}
BASE = "https://www.threads.com"
JSON_SCRIPT = re.compile(r'<script type="application/json"[^>]*>(.*?)</script>', re.S)


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(1)


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def profile_url(value):
    v = value.strip()
    m = re.match(r"^https?://(www\.)?threads\.(net|com)/@([\w.]+)", v)
    if m:
        return f"{BASE}/@{m.group(3)}"
    m = re.match(r"^@?([\w.]+)$", v)
    if m:
        return f"{BASE}/@{m.group(1)}"
    raise ValueError(f"not a Threads username or profile URL: {value}")


def search_url(query, recent=False):
    q = {"q": query, "serp_type": "default"}
    if recent:
        q["filter"] = "recent"
    return f"{BASE}/search?{urllib.parse.urlencode(q)}"


def extract_posts(html):
    """Every dict that looks like a post (has text_post_app_info + like_count + code)."""
    found = {}

    def walk(o):
        if isinstance(o, dict):
            if "text_post_app_info" in o and "like_count" in o and o.get("code"):
                found.setdefault(o["code"], o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for blob in JSON_SCRIPT.findall(html):
        if "text_post_app_info" not in blob:
            continue
        try:
            walk(json.loads(blob))
        except ValueError:
            continue
    return list(found.values())


def to_post(raw, source):
    info = raw.get("text_post_app_info") or {}
    user = raw.get("user") or {}
    username = user.get("username") or ""
    caption = (raw.get("caption") or {}).get("text") or ""
    likes = raw.get("like_count") or 0
    replies = info.get("direct_reply_count") or 0
    reposts = info.get("repost_count") or 0
    quotes = info.get("quote_count") or 0
    taken = raw.get("taken_at")
    media = {1: "image", 2: "video", 8: "carousel", 19: "text"}.get(raw.get("media_type"), "other")
    return {
        "code": raw["code"],
        "url": f"{BASE}/@{username}/post/{raw['code']}",
        "author": username,
        "verified": bool(user.get("is_verified")),
        "text": caption,
        "media": media,
        "likes": likes,
        "replies": replies,
        "reposts": reposts,
        "quotes": quotes,
        "engagement": likes + 2 * replies + 3 * (reposts + quotes),
        "is_reply": bool(info.get("is_reply")),
        "created": datetime.datetime.fromtimestamp(taken, datetime.timezone.utc).strftime("%Y-%m-%d") if taken else None,
        "taken_at": taken,
        "source": source,
    }


def scan(label, url):
    try:
        html = fetch(url)
    except Exception as e:  # noqa: BLE001 - one failed source must not kill the whole scan
        return label, [], f"{label}: could not load page ({e})"
    raws = extract_posts(html)
    if not raws:
        return label, [], f"{label}: no posts found (private, empty, or Threads blocked the request)"
    return label, [to_post(r, label) for r in raws], None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--search", action="append", default=[], help="keyword (repeatable)")
    ap.add_argument("--profile", action="append", default=[], help="@username or profile URL (repeatable)")
    ap.add_argument("--recent", action="store_true", help="search the Recent tab instead of Top")
    ap.add_argument("--days", type=int, default=0, help="only keep posts from the last N days (0 = all)")
    ap.add_argument("--min-likes", type=int, default=0)
    ap.add_argument("--include-replies", action="store_true", help="keep posts that are replies to others")
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()

    sources = []
    for q in args.search:
        if q.strip():
            sources.append((f"search:{q.strip()}", search_url(q.strip(), args.recent)))
    for p in args.profile:
        try:
            u = profile_url(p)
        except ValueError as e:
            fail(str(e))
        sources.append((f"profile:@{u.rsplit('@', 1)[1]}", u))
    if not sources:
        fail("give at least one --search or --profile")
    if len(sources) > 10:
        fail("at most 10 sources per run")

    posts, errors = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = []
        for label, url in sources:
            futures.append(pool.submit(scan, label, url))
            time.sleep(0.3)  # stagger to stay polite
        for f in futures:
            label, items, err = f.result()
            if err:
                errors.append(err)
            for p in items:
                if p["code"] in posts:
                    if label not in posts[p["code"]]["source"]:
                        posts[p["code"]]["source"] += f", {label}"
                else:
                    posts[p["code"]] = p

    if not posts:
        fail("; ".join(errors) or "no posts found")

    scanned = len(posts)
    items = list(posts.values())
    if not args.include_replies:
        items = [p for p in items if not p["is_reply"]]
    if args.days > 0:
        cutoff = time.time() - args.days * 86400
        items = [p for p in items if (p["taken_at"] or 0) >= cutoff]
    items = [p for p in items if p["likes"] >= args.min_likes]
    items.sort(key=lambda p: (p["engagement"], p["likes"]), reverse=True)
    items = items[: max(1, args.limit)]
    for rank, p in enumerate(items, 1):
        p["rank"] = rank
        p.pop("taken_at", None)
        if len(p["text"]) > 600:
            p["text"] = p["text"][:600] + "…"

    print(json.dumps({
        "ok": True,
        "sources": [label for label, _ in sources],
        "scanned": scanned,
        "count": len(items),
        "sorted_by": "engagement = likes + 2*replies + 3*(reposts+quotes)",
        "errors": errors,
        "posts": items,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
