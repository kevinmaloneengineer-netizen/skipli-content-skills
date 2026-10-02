#!/usr/bin/env python3
"""List recent reels of a public Facebook profile/page, with caption and stats.

Reads the public reels tab (no login, no API key). The page embeds the ~10
latest reels; with --count N the rest are paged in through the same GraphQL
query the reels tab uses, still logged-out (≈10 reels per request).

Outputs a single JSON object on stdout:
  {"ok": true, "profile": ..., "count": N, "reels": [{"id", "url", "caption", "plays", ...}]}
  {"ok": false, "error": "..."}

Usage:
  python3 list_reels.py <profile_or_reels_url> --count 100 --stats --limit 30   # 100 latest, no login
  python3 list_reels.py <profile_or_reels_url> [--limit 10] [--stats]
  python3 list_reels.py --ids 123,456,...   [--limit 10]   # IDs collected by the browser; implies --stats
  python3 list_reels.py --ids @ids.txt      [--limit 10]   # one ID per line / comma separated
"""

import argparse
import concurrent.futures
import os
import datetime
import html as htmllib
import json
import time
import re
import sys
import urllib.parse
import urllib.request

# Facebook serves the full server-rendered profile (with embedded reel data)
# to its own link-preview crawler; normal browser UAs get a login wall.
HEADERS = {
    "User-Agent": "facebookexternalhit/1.1",
    "Accept": "text/html",
    "Accept-Language": "en-US,en;q=0.9",
}


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(1)


def reels_tab_url(url):
    """Normalize any profile/page URL to its reels tab."""
    u = urllib.parse.urlparse(url.strip())
    host = (u.hostname or "").lower()
    if not re.search(r"(^|\.)facebook\.com$", host):
        fail("URL must be a facebook.com profile or page link")
    if u.path.rstrip("/") == "/profile.php":
        pid = urllib.parse.parse_qs(u.query).get("id", [""])[0]
        if not pid.isdigit():
            fail("profile.php URL is missing a numeric id")
        return f"https://www.facebook.com/profile.php?id={pid}&sk=reels_tab"
    parts = [p for p in u.path.split("/") if p]
    if not parts or parts[0] in ("reel", "watch", "share", "groups"):
        fail("expected a profile/page URL like https://www.facebook.com/<name>/reels/")
    return f"https://www.facebook.com/{parts[0]}/reels/"


def fetch_raw(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def fetch(url):
    try:
        return fetch_raw(url)
    except Exception as e:  # noqa: BLE001 - report any network failure as JSON
        fail(f"could not load page: {e}")


def parse_count(text):
    """'948' -> 948, '1.2K' -> 1200, '3,4 N' -> None (unknown format)."""
    if text is None:
        return None
    s = str(text).strip().upper().replace(",", "")
    m = re.match(r"^([\d.]+)\s*([KMB]?)$", s)
    if not m:
        return None
    mult = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[m.group(2)]
    try:
        return int(float(m.group(1)) * mult)
    except ValueError:
        return None


def extract_edges(html):
    """Collect reel edges from every embedded aggregated_fb_shorts block."""
    decoder = json.JSONDecoder()
    key = '"aggregated_fb_shorts":'
    edges, pos = [], 0
    while True:
        i = html.find(key, pos)
        if i < 0:
            break
        pos = i + len(key)
        try:
            obj, _ = decoder.raw_decode(html, pos)
        except ValueError:
            continue
        if isinstance(obj, dict):
            edges.extend(obj.get("edges") or [])
    return edges


def to_reel(edge):
    node = (edge.get("profile_reel_node") or {}).get("node") or {}
    ctx = node.get("short_form_video_context") or {}
    video = ctx.get("playback_video") or ctx.get("video") or {}
    vid = video.get("id") or (ctx.get("video") or {}).get("id")
    if not vid:
        return None
    created = node.get("creation_time")
    duration = video.get("length_in_second")
    if duration is None and (ctx.get("video") or {}).get("playable_duration_in_ms"):
        duration = ctx["video"]["playable_duration_in_ms"] / 1000
    plays_text = ctx.get("play_count_reduced")
    return {
        "id": vid,
        "url": video.get("permalink_url") or f"https://www.facebook.com/reel/{vid}/",
        "caption": (node.get("message") or {}).get("text") or "",
        "plays": parse_count(plays_text),
        "plays_text": plays_text,
        "duration": round(duration, 1) if duration else None,
        "created": datetime.datetime.fromtimestamp(created, datetime.timezone.utc).strftime("%Y-%m-%d") if created else None,
        "music": ctx.get("track_title"),
        "owner": (ctx.get("video_owner") or {}).get("name"),
    }


# ---- logged-out pagination of the reels tab -------------------------------------------
# The reels tab pages with Relay query ProfileCometAppCollectionReelsRendererPaginationQuery.
# Facebook rotates the doc_id on deploys; if the pinned one stops working we re-read it
# (and its "provided variables") from the page's JS bundles.
REELS_QUERY = "ProfileCometAppCollectionReelsRendererPaginationQuery"
DOC_ID = os.environ.get("FB_REELS_DOC_ID", "28838816002422324")
PROVIDED_VARS = [
    "CometAudioLanguageUtils_comet_translations_revamp_preferred_languages_gk", "FBReelsMediaFooter_comet_enable_reels_ads_gk",
    "FBReels_deprecate_short_form_video_context_gk", "FBReels_enable_view_dubbed_audio_type_gk",
    "FBUnifiedVideoCometVideoMedia_comet_photosensitive_content_warning_gk",
    "FBUnifiedVideoDescriptionWithEntities_comet_translations_revamp_sync_caption_with_audio_gk",
    "FBUnifiedVideoFeedbackBar_comet_reels_save_button_gk", "FBUnifiedVideoMediaContentContainer_comet_reels_video_footer_defer_loading_gk",
    "FBUnifiedVideoMediaContentContainer_comet_video_document_picture_in_picture_gk", "FBUnifiedVideoMediaContentContainer_enable_chapters_pill_gk",
    "FBUnifiedVideoMediaFooter_comet_enable_reels_ads_gk", "FBUnifiedVideoMediaFooter_enable_ai_embodiment_chat_pill_gk",
    "FBUnifiedVideoMediaFooter_enable_meta_ai_pill_gk", "FBUnifiedVideoMediaFooter_enable_video_augment_pills_gk",
    "FBUnifiedVideoMediaFooter_organic_ad_cta_on_comet_gk", "FBUnifiedVideoMediaHeaderControls_enable_chapters_pill_gk",
    "FBUnifiedVideoMenu_fb_reels_ranking_debug_tool_gk", "FBUnifiedVideoPlayerScrubber_fb_comet_vpv_heatmap_gk",
    "ShouldEnableBakedInTextUnifiedVideo", "usePushPipEngagementCounts_comet_video_document_picture_in_picture_gk",
]


def _first_cursor(html):
    i = html.find('"aggregated_fb_shorts"')
    if i < 0:
        return None
    m = re.search(r'"page_info":\{[^}]*"end_cursor":"([^"]+)"', html[i:])
    return m.group(1) if m else None


def _collection_candidates(html):
    """app_collection node ids on the page, nearest to the embedded reels first."""
    anchor = html.find('"aggregated_fb_shorts"')
    found = {}
    for m in re.finditer(r'"id":"(YXBwX2NvbGxlY3Rpb2[^"]+)"', html):
        found.setdefault(m.group(1), abs(m.start() - anchor))
    return sorted(found, key=found.get)


def _discover_query(html):
    """Re-read the reels query doc_id and provided variables from the page's JS bundles."""
    urls = sorted({u.replace("\\/", "/") for u in re.findall(r'https:\\?/\\?/static\.xx\.fbcdn\.net\\?/rsrc\.php[^"\']+\.js[^"\']*', html)})

    def get(u):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=20) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception:  # noqa: BLE001
            return ""

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for js in pool.map(get, urls):
            m = re.search(r'__d\("%s_facebookRelayOperation",\[\],\(function\([^)]*\)\{\w+\.exports="(\d+)"' % REELS_QUERY, js)
            if not m:
                continue
            seg = js[js.find('__d("%s.graphql"' % REELS_QUERY):][:40000]
            pvs = sorted({p[len("__relay_internal__pv__"):-len("relayprovider")]
                          for p in re.findall(r"__relay_internal__pv__[A-Za-z0-9_]+relayprovider", seg)})
            return m.group(1), pvs or PROVIDED_VARS
    return None, None


def _graphql_page(lsd, collection, cursor, referer, doc_id, pvs):
    """One page of the reels collection: (reels, next_cursor). Raises ValueError on an unexpected answer."""
    variables = {"count": 10, "cursor": cursor, "id": collection, "renderLocation": None, "scale": 1, "useDefaultActor": False}
    variables.update({f"__relay_internal__pv__{p}relayprovider": False for p in pvs})
    body = urllib.parse.urlencode({
        "av": "0", "__user": "0", "__a": "1", "lsd": lsd, "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": REELS_QUERY, "variables": json.dumps(variables),
        "server_timestamps": "true", "doc_id": doc_id,
    }).encode()
    req = urllib.request.Request("https://www.facebook.com/api/graphql/", data=body, headers={
        **HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-FB-LSD": lsd,
        "X-FB-Friendly-Name": REELS_QUERY, "Origin": "https://www.facebook.com", "Referer": referer,
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        first_line = r.read().decode("utf-8", "ignore").split("\n", 1)[0]
    data = json.loads(first_line)

    def connections(o):
        if isinstance(o, dict):
            if "edges" in o and "page_info" in o:
                yield o
            for v in o.values():
                yield from connections(v)
        elif isinstance(o, list):
            for v in o:
                yield from connections(v)

    conn = next(connections(data.get("data")), None)
    if conn is None:
        raise ValueError((data.get("errors") or [{}])[0].get("message") or "no reels connection in response")
    page = conn.get("page_info") or {}
    reels = [r for r in (to_reel(e) for e in conn.get("edges") or []) if r]
    return reels, (page.get("end_cursor") if page.get("has_next_page") else None)


def paginate(tab, html, reels, want):
    """Extend the first-page reels to `want` by paging logged-out. Returns (reels, note)."""
    lsd = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', html)
    cursor = _first_cursor(html)
    if not lsd or not cursor:
        return reels, "no pagination token on the page; returned the reels embedded in it"
    lsd = lsd.group(1)
    seen = {r["id"] for r in reels}
    doc_id, pvs, rediscovered = DOC_ID, PROVIDED_VARS, False
    collections = _collection_candidates(html)
    collection = None
    while len(reels) < want and cursor:
        try:
            if collection is None:  # find which collection id answers with reels
                for c in collections:
                    page, nxt = _graphql_page(lsd, c, cursor, tab, doc_id, pvs)
                    if page:
                        collection = c
                        break
                else:
                    raise ValueError("no collection answered with reels")
            else:
                page, nxt = _graphql_page(lsd, collection, cursor, tab, doc_id, pvs)
        except Exception as e:  # noqa: BLE001
            if rediscovered:
                return reels, f"pagination stopped after {len(reels)} reels ({e})"
            rediscovered = True
            doc_id, pvs = _discover_query(html)
            if not doc_id:
                return reels, f"pagination unavailable ({e}); returned {len(reels)} reels"
            continue
        added = [r for r in page if r["id"] not in seen]
        if not added and not nxt:
            break
        for r in added:
            seen.add(r["id"])
            reels.append(r)
        cursor = nxt
        time.sleep(0.6)  # stay polite: ~1.5 requests/s
    return reels[:want], f"paged logged-out: {len(reels[:want])} latest reels"


def _first_int(pattern, html):
    m = re.search(pattern, html)
    return int(m.group(1)) if m else None


def fetch_stats(reel):
    """Add reactions / comments / shares from the reel's own page (1 light request, no download)."""
    try:
        html = fetch_raw(f"https://www.facebook.com/reel/{reel['id']}")
    except Exception as e:  # noqa: BLE001 - one bad reel must not break the whole scan
        reel["stats_error"] = str(e)
        return reel
    reactions, comments, shares = _own_stats(html, reel["id"])
    reel["reactions"] = reactions
    if not reel.get("caption"):
        m = re.search(r'<meta property="og:description" content="([^"]*)"', html)
        reel["caption"] = htmllib.unescape(m.group(1)) if m else ""
    if not reel.get("created"):
        ts = _first_int(r'"creation_time":(\d+)', html)
        reel["created"] = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%d") if ts else None
    if not reel.get("duration"):
        m = re.search(r'"length_in_second":([\d.]+)', html)
        reel["duration"] = round(float(m.group(1)), 1) if m else None
    if reel.get("plays") is None:
        m = re.search(r'<meta property="og:title" content="([\d.,]+[KMB]?) views', html)
        if m:
            reel["plays_text"] = m.group(1)
            reel["plays"] = parse_count(m.group(1))
    reel["comments"] = comments
    reel["shares"] = shares
    if reactions is None:
        # No block tied to this reel: take reactions from og:title ("36K views · 338 reactions | …")
        # and leave comments/shares empty rather than borrowing another video's numbers.
        m = re.search(r'<meta property="og:title" content="[^"]*?([\d.,]+[KMB]?) reactions', html)
        reel["reactions"] = parse_count(m.group(1)) if m else None
        reel["stats_partial"] = True
    return reel


_REACTORS = re.compile(r'"unified_reactors":\{"count":(\d+)\}')
_BLOCK_VIDEO = re.compile(r'(?:top_level_post_id|video_id)\\?":\\?"(\d+)')


def _own_stats(html, reel_id):
    """(reactions, comments, shares) of `reel_id` itself.

    A reel page embeds several videos (the reel plus suggestions), each with its
    own feedback block, in no fixed order - taking the first count on the page
    gives another video's numbers. Each block is
      …total_comment_count, share_count_reduced … unified_reactors … tracking{video_id}
    so pick the block whose tracking video_id is ours, and read comments/shares
    between the previous block's reactors and ours.
    """
    matches = list(_REACTORS.finditer(html))
    for i, m in enumerate(matches):
        tail = html[m.end():m.end() + 4000]
        v = _BLOCK_VIDEO.search(tail)
        if not v or v.group(1) != reel_id:
            continue
        segment = html[matches[i - 1].end() if i else 0:m.start()]
        comments = re.findall(r'"total_comment_count":(\d+)', segment)
        shares = re.findall(r'"share_count_reduced":"([^"]*)"', segment)
        return int(m.group(1)), (int(comments[-1]) if comments else None), (parse_count(shares[-1]) if shares else None)
    return None, None, None


def engagement(reel):
    """Weighted engagement: shares and comments signal more interest than a reaction."""
    return (reel.get("reactions") or 0) + 2 * (reel.get("comments") or 0) + 3 * (reel.get("shares") or 0)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url", nargs="?", help="profile/page URL, e.g. https://www.facebook.com/tony.g.jung/reels/")
    p.add_argument("--ids", help="comma-separated reel IDs, or @file with IDs (from the browser scroll); implies --stats")
    p.add_argument("--limit", type=int, default=10, help="max reels to return")
    p.add_argument("--count", type=int, default=10,
                   help="how many latest reels to scan (default 10 = the ones embedded in the page; up to 200, paged logged-out)")
    p.add_argument("--stats", action="store_true",
                   help="also fetch reactions/comments/shares per reel and sort by engagement")
    args = p.parse_args()

    if args.ids:
        raw = args.ids
        if raw.startswith("@"):
            try:
                raw = open(raw[1:]).read()
            except OSError as e:
                fail(f"cannot read IDs file: {e}")
        ids = list(dict.fromkeys(re.findall(r"\d{8,20}", raw)))  # dedupe, keep order
        if not ids:
            fail("no reel IDs found in --ids")
        ids = ids[:300]
        reels = [{"id": i, "url": f"https://www.facebook.com/reel/{i}/", "caption": "", "plays": None,
                  "plays_text": None, "duration": None, "created": None} for i in ids]
        args.stats = True
        tab = args.url or "(ids)"
    elif not args.url:
        fail("give a profile URL or --ids")
    else:
        tab, reels = None, None

    note = None
    if reels is None:
        tab, reels, html = scan_tab(args.url)
        want = max(1, min(args.count, 200))
        if want > len(reels):
            reels, note = paginate(tab, html, reels, want)

    run(args, tab, reels, note)


def scan_tab(url):
    tab = reels_tab_url(url)
    html = fetch(tab)

    reels, seen = [], set()
    for edge in extract_edges(html):
        r = to_reel(edge)
        if r and r["id"] not in seen:
            seen.add(r["id"])
            reels.append(r)

    if not reels:
        # Fallback: bare IDs only (layout changed or partial page).
        for m in re.finditer(r'reel\\?/(\d{8,20})', html):
            if m.group(1) not in seen:
                seen.add(m.group(1))
                reels.append({"id": m.group(1), "url": f"https://www.facebook.com/reel/{m.group(1)}/",
                              "caption": "", "plays": None, "plays_text": None,
                              "duration": None, "created": None, "music": None, "owner": None})
    if not reels:
        fail("no reels found - the profile may be private, have no reels, or Facebook blocked the request")
    return tab, reels, html


def run(args, tab, reels, note=None):
    scanned = len(reels)
    sort_by = "recent"
    if args.stats:
        # Small pool + slight stagger to stay polite and avoid rate limits.
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = []
            for r in reels:
                futures.append(pool.submit(fetch_stats, r))
                time.sleep(0.25)
            reels = [f.result() for f in futures]
        for r in reels:
            r["engagement"] = engagement(r)
        reels.sort(key=lambda r: (r["engagement"], r.get("plays") or 0), reverse=True)
        for rank, r in enumerate(reels, 1):
            r["rank"] = rank
        sort_by = "engagement = reactions + 2*comments + 3*shares"

    reels = reels[: max(1, args.limit)]
    for r in reels:
        if r.get("caption") and len(r["caption"]) > 400:
            r["caption"] = r["caption"][:400] + "…"
    print(json.dumps({
        "ok": True,
        "profile": tab,
        "scanned": scanned,
        "count": len(reels),
        "sorted_by": sort_by,
        "note": ("IDs supplied by caller." if args.ids
                 else note or "Only the ~10 reels embedded in the page (use --count N to page further)."),
        "reels": reels,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
