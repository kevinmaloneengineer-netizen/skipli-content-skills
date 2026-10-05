---
name: fb-reel-reader
description: Use this skill when the user sends a Facebook Reel / Facebook video link (facebook.com/reel/..., fb.watch/..., facebook.com/.../videos/...) and wants to know what is in it, OR sends a Facebook profile/page link (facebook.com/<name>/reels/) and wants the best / most relevant reels of that channel picked, ranked or summarized - optionally for a given topic. Also works for single Instagram Reels, TikTok and YouTube Shorts links.
---

# Facebook Reel Reader

Two modes:

- **Single reel** - user sends one or more reel links → analyze each (Steps 2–4).
- **Channel** - user sends a profile/page link (e.g. `https://www.facebook.com/tony.g.jung/reels/`) and asks for the best N reels (default 5), optionally about a topic → Step 1, then Steps 2–4 for the shortlist only.

## Step 1 - (Channel mode) Collect, score and shortlist reels

**If the request already contains a list of reel IDs** (e.g. "Danh sách 100 reel mới nhất … đã được lấy sẵn"), skip 1a and go straight to 1b with exactly those IDs (`--limit 30`). Report the number of IDs given as the number of reels scanned.

### 1a. Scan the latest reels of the channel (no login, no browser)

```bash
python3 {baseDir}/scripts/list_reels.py "<PROFILE_OR_PAGE_URL>" --count 100 --stats --limit 30
```

- `--count N` = how many of the latest reels to scan (default 100 when the user does not say; `--count 10` for a quick scan). The script pages through the public reels tab logged-out (~10 per request) and then fetches reactions/comments/shares for every reel - no AI tokens, ~1 minute for 100.
- Output is `{"ok", "scanned", "count", "note", "reels": [...]}` sorted by engagement; go straight to 1c with these reels.
- If `scanned` is lower than asked, the channel simply has fewer reels or pagination stopped - the `note` says which. Use what you got and mention it in the report; do **not** retry in a loop.
- Only if the script fails completely (`ok: false`) may you fall back to the logged-in browser below.

### 1a′. Fallback: collect reel IDs with the logged-in browser

1. `browser` → `{"action": "open", "targetUrl": "https://www.facebook.com/<name>/reels/"}`. Keep the returned `targetId`.
2. `browser` → `{"action": "act", "targetId": "<id>", "timeoutMs": 45000, "request": {"kind": "evaluate", "fn": <contents of {baseDir}/scripts/collect_reels.js>}}`.
   Get that file once with exec `cat {baseDir}/scripts/collect_reels.js`, then pass its full text unchanged as `fn`.
   It auto-scrolls ~20 s per call and returns `{"ok", "count", "done", "ids"}`.
3. Repeat step 2 (same `targetId`, same `fn`) until `done` is true - at most 10 calls. Do **not** take snapshots/screenshots; they waste tokens.
4. When `done`, `ids` is a comma-separated list. Close the tab (`{"action": "close", "targetId": "<id>"}`), then run 1b with those IDs.

If the browser tool is unavailable, errors, or returns `login_required: true`, use the quick scan in 1b and tell the user that only the ~10 most recent reels could be scanned.

### 1b. Score engagement for a given ID list (no login, no AI tokens)

With IDs from the request or from 1a′:

```bash
python3 {baseDir}/scripts/list_reels.py --ids "<comma-separated ids>" --limit 30
```

Quick-scan fallback (only ~10 most recent reels):

```bash
python3 {baseDir}/scripts/list_reels.py "<PROFILE_OR_PAGE_URL>" --stats
```

Both return `{"ok": true, "scanned": N, "reels": [...]}` **sorted by engagement** (highest first). Each reel has: `rank`, `id`, `url`, `caption`, `reactions`, `comments`, `shares`, `engagement` (= reactions + 2×comments + 3×shares), `plays_text`, `duration`, `created`.

### 1c. Shortlist (metadata only, nothing downloaded yet)

1. **Skip duplicates**: creators re-post the same video - if two captions are near-identical, keep the one with higher `engagement`.
2. **With a topic** (e.g. "SEO", "nấu ăn", "AI tools"): drop reels whose caption is clearly off-topic (synonyms, Vietnamese/English both count). Keep vague captions (e.g. "Comment SEO 👇") - the video may still be on-topic.
3. Take the **top 10 by engagement** as candidates (fewer if the channel has fewer).

Steps 2–3 run on these candidates; after watching, pick the best N (default 5) for the report - rank by real content quality/relevance, using engagement as a tie-breaker. Show the user a compact engagement table of the top candidates in the final answer.

## Step 2 - Download and preprocess each shortlisted reel

```bash
python3 {baseDir}/scripts/fetch_reel.py "<REEL_URL>"
```

Options: `--frames N` (default 6), `--out DIR` (default `reels`), `--cookies FILE` (Netscape cookies.txt, only if the user provides one).

Returns `{"ok": true, "id", "title", "caption", "uploader", "duration", "view_count", "video", "audio", "frames": [...]}` or `{"ok": false, "error": "..."}`.

Failures: private/login-required → ask for cookies.txt or say only public reels work. `yt_dlp` missing → tell the user to click **Skill → Install all dependencies**. Rate-limited → stop and report; do not loop.

## Step 3 - Analyze

Try in this order and **remember which sources actually succeeded**:

1. **`read_video`** with `path` = the `video` field - describe scenes, on-screen text, spoken content, overall message. (Needs a Gemini/OpenRouter provider.)
2. If that fails: **`read_audio`** on `audio` (transcript; skip if `audio` is null) and **`read_image`** on 3–6 `frames` (visuals, on-screen text).
3. The `caption` is always available - use it, but it is the poster's text, **not** what is said in the video.

In channel mode, after analysis, re-rank the shortlist if the actual content changes your judgement (e.g. caption promised a topic the video doesn't deliver).

## Step 4 - Report

Answer in the user's language.

**Single reel:**

- **Tóm tắt / Summary:** 2–4 sentences.
- **Lời thoại / Speech:** only if `read_video` or `read_audio` succeeded.
- **Hình ảnh / Visuals:** only if `read_video` or `read_image` succeeded.
- **Caption & hashtag:** from the post.
- **Thông tin:** uploader, duration, views, date, link.
- **Nguồn phân tích / Sources:** list what was used, e.g. `video ✅ · audio ❌ · frames ❌ · caption ✅`.

**Channel mode:** a ranked list of the top N:

```
### 1. <short title you write>
👍 <reactions> · 💬 <comments> · 🔁 <shares> · <plays_text> views · <duration>s · <created>
<link>
- Vì sao chọn / Why: <relevance to topic or why it is strong>
- Nội dung chính / Key points: <2–3 bullets>
```

Then one closing line: how many reels were scanned (the N latest from a provided ID list, the full channel via browser, or only the ~10 most recent), how many were watched, and the analysis sources used.

## Rules

- **Hạn chế dấu gạch ngang.** Không dùng "—", "–" hay " - " để nối ý trong câu hoặc trong tiêu đề; dùng dấu phẩy, dấu chấm hoặc dấu hai chấm. Khoảng số viết "từ 3 đến 5", không viết "3–5". (Gạch đầu dòng của danh sách thì vẫn dùng bình thường.)
- **Write the report for a business owner, not a developer.** Never mention script names, flags, tools, APIs or internals (`list_reels.py`, `--count`, pagination, exec, Gemini, yt-dlp…). Say what was scanned in plain words, e.g. "Đã quét toàn bộ 82 reel của kênh" or "Đã quét 100 reel mới nhất".
- If fewer reels were scanned than asked because the channel has no more, say it is the whole channel - it is not an error. Only mention a limitation when something actually failed, and then in one plain sentence.

- **Always run the scripts fresh for every request.** Never answer from results earlier in the conversation (they may be stale or from a failed/fallback run) unless the user explicitly asks to reuse them.
- **Never present caption text as speech or visuals.** If only the caption was available, say clearly: "⚠️ Chỉ dựa trên caption, chưa xem/nghe được video" (or the English equivalent).
- Do not invent content you did not see or hear.
- Only process public content. Never try to bypass login walls or privacy settings.
- Process reels one at a time; keep the total under ~10 downloads per request.
- Downloaded files stay in the workspace under `reels/<id>/`. Delete them if the user asks to clean up.
