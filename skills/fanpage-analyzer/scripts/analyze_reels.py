#!/usr/bin/env python3
"""Turn list_reels.py output into posting/engagement statistics for a fanpage report.

Numbers are computed here so the report never relies on the model doing arithmetic.

Usage:
  python3 list_reels.py <page_url> --count 100 --stats --limit 200 > reels.json
  python3 analyze_reels.py reels.json          # or pipe the JSON on stdin

Times are shown in Vietnam time (UTC+7). Engagement = reactions + 2*comments + 3*shares.
Output: one JSON object (see keys in main()).
"""

import collections
import datetime
import json
import re
import statistics
import sys

VN = datetime.timezone(datetime.timedelta(hours=7))
WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
DURATIONS = [(0, 15, "dưới 15 giây"), (15, 30, "15 đến 30 giây"), (30, 60, "30 đến 60 giây"), (60, 10**9, "trên 60 giây")]
CAPTIONS = [(0, 1, "không có caption"), (1, 80, "ngắn (dưới 80 ký tự)"), (80, 250, "vừa (80 đến 250 ký tự)"), (250, 10**9, "dài (trên 250 ký tự)")]
HOURS = [(5, 11, "sáng (5h đến 11h)"), (11, 14, "trưa (11h đến 14h)"), (14, 18, "chiều (14h đến 18h)"), (18, 23, "tối (18h đến 23h)")]


def engagement(r):
    return (r.get("reactions") or 0) + 2 * (r.get("comments") or 0) + 3 * (r.get("shares") or 0)


def group(reels, key, order):
    """Per bucket: number of reels, median and average engagement (median resists one viral outlier)."""
    buckets = collections.defaultdict(list)
    for r in reels:
        k = key(r)
        if k is not None:
            buckets[k].append(r["eng"])
    rows = []
    for name in order:
        vals = buckets.get(name)
        if vals:
            rows.append({"group": name, "reels": len(vals), "median_engagement": round(statistics.median(vals)), "avg_engagement": round(sum(vals) / len(vals))})
    return rows


def in_range(value, table):
    if value is None:
        return None
    return next((label for lo, hi, label in table if lo <= value < hi), None)


def local(r):
    ts = r.get("created_ts")
    return datetime.datetime.fromtimestamp(ts, VN) if ts else None


def hour_bucket(r):
    t = local(r)
    if not t:
        return None
    return in_range(t.hour, HOURS) or "đêm (23h đến 5h)"


def main():
    data = json.load(open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin)
    if not data.get("ok"):
        print(json.dumps({"ok": False, "error": data.get("error", "no data")}, ensure_ascii=False))
        return
    reels = [r for r in data.get("reels", []) if r.get("reactions") is not None or r.get("plays") is not None]
    for r in reels:
        r["eng"] = engagement(r)
    if not reels:
        print(json.dumps({"ok": False, "error": "no reels with stats"}, ensure_ascii=False))
        return

    times = sorted(t for t in (local(r) for r in reels) if t)
    span_days = max(1, (times[-1] - times[0]).days) if len(times) > 1 else None
    engs = [r["eng"] for r in reels]
    median = statistics.median(engs)
    tags = collections.Counter(t.lower() for r in reels for t in re.findall(r"#(?!\d+\b)\w+", r.get("caption") or ""))
    top = sorted(reels, key=lambda r: r["eng"], reverse=True)

    def brief(r):
        t = local(r)
        return {"caption": (r.get("caption") or "")[:200], "url": r.get("url"), "engagement": r["eng"], "reactions": r.get("reactions"),
                "comments": r.get("comments"), "shares": r.get("shares"), "plays_text": r.get("plays_text"), "duration": r.get("duration"),
                "posted": t.strftime("%Y-%m-%d %H:%M") if t else r.get("created"), "x_median": round(r["eng"] / median, 1) if median else None}

    print(json.dumps({
        "ok": True,
        "profile": data.get("profile"),
        "reels_analyzed": len(reels),
        "period": {"from": times[0].strftime("%Y-%m-%d"), "to": times[-1].strftime("%Y-%m-%d"), "days": span_days} if times else None,
        "reels_per_week": round(len(times) / span_days * 7, 1) if span_days else None,
        "engagement": {"median": round(median), "average": round(sum(engs) / len(engs)), "max": max(engs), "total_shares": sum(r.get("shares") or 0 for r in reels),
                       "comments_per_reaction": round(sum(r.get("comments") or 0 for r in reels) / max(1, sum(r.get("reactions") or 0 for r in reels)), 3)},
        "viral": {"threshold": "engagement >= 3x median", "count": sum(1 for e in engs if median and e >= 3 * median)},
        "by_weekday": group(reels, lambda r: WEEKDAYS[local(r).weekday()] if local(r) else None, WEEKDAYS),
        "by_time_of_day": group(reels, hour_bucket, [b[2] for b in HOURS] + ["đêm (23h đến 5h)"]),
        "by_duration": group(reels, lambda r: in_range(r.get("duration"), DURATIONS), [b[2] for b in DURATIONS]),
        "by_caption_length": group(reels, lambda r: in_range(len(r.get("caption") or ""), CAPTIONS), [b[2] for b in CAPTIONS]),
        "top_hashtags": [{"tag": t, "reels": n} for t, n in tags.most_common(10)],
        "top": [brief(r) for r in top[:8]],
        "bottom": [brief(r) for r in top[-5:]] if len(top) > 10 else [],
        "note": "Groups with only 1 or 2 reels are not reliable; say so instead of drawing conclusions.",
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
