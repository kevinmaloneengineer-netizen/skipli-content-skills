---
name: threads-viral-finder
description: Use this skill when the user wants to find viral / trending / most-engaged Threads posts (threads.com, threads.net) for a keyword, niche or topic, or the top posts of one or more Threads accounts (@username), and wants them ranked, explained (why they went viral) and turned into content ideas. Vietnamese triggers include "tìm content viral Threads", "bài Threads nhiều tương tác", "trend Threads về ...".
---

# Threads Viral Finder

Find the most-engaged Threads posts for a topic or set of accounts, explain why they work, and suggest original angles the user can write about. No login, no AI tokens for scoring.

## Step 1 - Collect and score

```bash
python3 {baseDir}/scripts/threads_scan.py --search "<keyword 1>" --search "<keyword 2>" [--profile @user] [--days 30] [--limit 20]
```

- **Keywords**: run 2–4 variants of the topic in the user's language (e.g. topic "bán hàng online" → `--search "bán hàng online" --search "kinh doanh online" --search "bán hàng shopee"`). Each search returns ~20–30 "Top" posts; more variants = wider net.
- **Accounts**: `--profile @username` (or a profile URL) returns the ~10 most recent posts of that account.
- `--days N` keeps only recent posts (default: all; use 30 when the user asks for "trend" / "gần đây"). `--recent` searches the Recent tab instead of Top.
- Replies to other people are dropped unless `--include-replies`.

Returns `{"ok": true, "scanned", "count", "errors", "posts": [...]}` sorted by **engagement = likes + 2×replies + 3×(reposts+quotes)**. Each post has `rank`, `url`, `author`, `verified`, `text`, `media`, `likes`, `replies`, `reposts`, `quotes`, `engagement`, `created`, `source`.

If `ok` is false or `errors` is non-empty, tell the user which source failed; never invent posts.

## Step 2 - Filter

1. Drop posts clearly off-topic for the user's request (search matches loosely), spam, giveaways and pure ads.
2. Drop near-duplicates (same text reposted), keep the higher engagement.
3. Keep the best N (default 10).

## Step 3 - Report

Answer in the user's language. Start with one line: sources scanned, posts scanned, posts kept.

For each post:

```
### <rank>. @<author>
❤️ <likes> · 💬 <replies> · 🔁 <reposts> · <created>
<url>
> <first 1–2 sentences of the post, quoted verbatim>
- Vì sao viral / Why it works: <hook type, emotion, format, controversy, practical value…>
```

Then a section **Pattern chung / Common patterns** (3–5 bullets: hook styles, length, format, posting angles that recur among the top posts) and **Ý tưởng cho bạn / Ideas for you** (3–5 original post ideas in the user's niche inspired by those patterns, each one line).

## Rules

- If every source fails with `RATE_LIMITED` (HTTP 429), do not retry in a loop and never invent posts: answer in one or two plain sentences that Threads is temporarily limiting requests and to run it again in 30 to 60 minutes.
- **Write for a business owner, not a developer:** never mention scripts, flags, HTTP codes, "chạy lại script"; say what was scanned in plain words.
- **Hạn chế dấu gạch ngang.** Không dùng "—", "–" hay " - " để nối ý trong câu hoặc trong tiêu đề; dùng dấu phẩy, dấu chấm hoặc dấu hai chấm. Khoảng số viết "từ 3 đến 5", không viết "3–5". (Gạch đầu dòng của danh sách thì vẫn dùng bình thường.)

- **Always run the script fresh for every request.** Never reuse results from earlier in the conversation unless asked.
- Quote post text verbatim and attributed; never present someone else's post as an idea to copy. Ideas must be new angles, not rewrites of a specific post.
- Numbers come only from the script output. Do not estimate missing counts.
- Only public content; never try to log in or bypass restrictions.
