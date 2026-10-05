---
name: channel-cloner
description: Use this skill when the user asks to "nhân bản kênh" / clone a competitor channel into a batch of NEW posts for their own channel - learning from the competitor's best-performing content (a Facebook page/profile link, or posts pasted in the request) and writing original posts grouped by content pillar (Giải trí, Giáo dục, Tương tác, Bán hàng).
---

# Channel Cloner

Turn what works on a competitor's channel into a batch of **original** posts for the user's own channel. Learn the patterns, never copy the words.

## Step 1: Get the source posts

**A. Facebook page/profile link in the request** (no login needed, ~30 s):

```bash
python3 {baseDir}/scripts/list_reels.py "<PAGE_URL>" --count 30 --stats --limit 15
```

JSON out: `reels[]` sorted by engagement, each with `caption`, `reactions`, `comments`, `shares`, `plays_text`, `url`. Use the reels that have a caption; skip empty ones. Do **not** download or watch videos. If the script returns `"ok": false` or no captions at all, say so in one plain sentence and stop (suggest pasting the posts instead).

**B. Posts pasted between `<<<BÀI GỐC` and `BÀI GỐC>>>`**: split on blank lines / `---`; each chunk is one source post. No engagement numbers, so treat them in the order given.

## Step 2: Learn, per source post

For each strong source post, note privately: hook type, emotion, format (list, story, question, tip, offer…), length, CTA. Pick the best `count` sources (repeat a strong one with a different angle if there are too few).

## Step 3: Write

Write exactly the requested number of posts for the **user's** topic/brand, spread evenly over the requested pillars:

- **Giải trí**: relatable humour, trend, behind-the-scenes, light story.
- **Giáo dục**: tips, how-to, mistakes to avoid, myth vs fact.
- **Tương tác**: question, poll, "A hay B", fill-in-the-blank; must invite comments.
- **Bán hàng**: product benefit, offer, problem to solution, clear CTA with `[GIÁ]`, `[LINK]` placeholders.

Platform defaults: facebook 80 to 200 words, strong first line, 3 to 5 hashtags at the end; threads ≤ 500 characters, no hashtag wall; tiktok a 30 to 60 s script (`Hook (0-3s)`, scenes with lời thoại + hình ảnh, `CTA`) then a caption.

## Output format (the UI parses this, follow it exactly)

```
Đã đọc <N> bài của kênh, chọn <K> bài nhiều tương tác nhất làm gốc.

## Bài 1 · Giáo dục: <short title you write>
> Gốc: <one line: the source post's idea in your words> · 👍 <reactions> · 💬 <comments> · 🔁 <shares>
<the new post, ready to paste>

## Bài 2 · Bán hàng: <title>
> Gốc: <…>
<post>

---
**Ghi chú:** <1 to 3 bullets: patterns borrowed, what to fill in>
```

- The pillar after `·` must be one of: `Giải trí`, `Giáo dục`, `Tương tác`, `Bán hàng`.
- `> Gốc:` is one line. Omit the numbers for pasted posts.
- No `---` inside a post.

## Rules

- **Original only.** Never reuse sentences, distinctive phrases, stories, personal claims, numbers or brand names from the source. Keep the pattern, change everything else.
- Write only what the user's brief supports. No fake reviews, invented results, prices or promotions; use `[GIÁ]`, `[LINK]`, `[SĐT]` placeholders.
- No health or financial guarantees.
- **Hạn chế dấu gạch ngang.** Không dùng "—", "–" hay " - " để nối ý trong bài và tiêu đề; dùng dấu phẩy, dấu chấm hoặc dấu hai chấm. (Gạch đầu dòng của danh sách vẫn dùng bình thường.)
- Write for a business owner: never mention scripts, flags, tools or APIs.
