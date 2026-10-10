import path from "node:path";
import { channelPromptWithIds, TIME_ZONES } from "./prompts.mjs";
import { fetchReviews } from "./sources/maps.mjs";
import { apifyReviewsEnabled, fetchReviewsApify } from "./sources/mapsApify.mjs";
import { findVideos } from "./sources/tiktok.mjs";
import { fetchInstagramPosts, fetchYelpReviews, socialEnabled } from "./sources/socialApify.mjs";
import { complete, directEnabled } from "./llm.mjs";
import { watchReel } from "./watch.mjs";
import { reelLine, runScript, threadLine } from "./scanners.mjs";

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n));

/** TikTok: search the videos, read their numbers, watch the top ones, then hand everything to the model. */
async function tiktokPrompt(input, { setPhase, signal }) {
  await setPhase("Đang tìm video TikTok…");
  const { scanned, videos } = await findVideos({ keywords: input.keywords, profiles: input.profiles, limit: input.top, signal, onProgress: setPhase });
  if (!videos.length) throw new Error("Không tìm thấy video TikTok nào cho từ khoá này. Thử từ khoá khác hoặc tên tài khoản.");
  const line = (v, i) => `${i + 1}. ${v.url}\n   views ${fmt(v.views)} · likes ${fmt(v.likes)} · comments ${fmt(v.comments)} · shares ${fmt(v.shares)} · saves ${fmt(v.saves)} · ${v.duration}s · ${v.createdAt} · @${v.author}${v.music ? ` · âm thanh: ${v.music.slice(0, 60)}` : ""}\n   caption: ${v.desc.slice(0, 200)}`;
  const { notes, log } = directEnabled() ? await watchAll(videos.map((v, i) => ({ url: v.url, line: line(v, i) })), { setPhase, signal, label: "video" }) : { notes: videos.map(line), log: [] };
  await setPhase(`Đã xem ${videos.length} video, AI đang phân tích…`);
  const target = [...input.keywords.map((k) => `"${k}"`), ...input.profiles].join(", ");
  return {
    fields: log.length ? { watch: log } : undefined,
    prompt: [
      `Phân tích video TikTok viral cho ${target} theo skill tiktok-viral-finder, bằng tiếng Việt. Đã đọc ${scanned} video, đây là ${videos.length} video tương tác cao nhất (xếp sẵn):`,
      notes.join("\n\n"),
      log.length ? `${SOURCE_RULE} "Hook" và "Vì sao viral" phải dựa vào phần ĐÃ XEM khi có.` : "",
      input.business ? `Kinh doanh của người dùng (để gợi ý ý tưởng quay): ${input.business}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}

/** The group with the best median engagement among groups with at least 3 reels. */
const bestGroup = (groups = []) => groups.filter((g) => g.reels >= 3).sort((a, b) => b.median_engagement - a.median_engagement)[0]?.group ?? "chưa đủ dữ liệu";

/** Compare 2 to 3 pages: read each one (50 latest reels), compute the numbers here, the model only comments. */
async function comparePrompt(input, { setPhase, signal }) {
  const pages = [];
  for (const [i, url] of input.urls.entries()) {
    const name = new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
    await setPhase(`Đang đọc kênh ${i + 1}/${input.urls.length}: @${name}…`);
    try {
      const list = await runScript("fanpage-analyzer", "list_reels.py", [url, "--count", "50", "--stats", "--limit", "100"], { signal });
      const st = await runScript("fanpage-analyzer", "analyze_reels.py", ["--tz", input.tz ?? "Asia/Ho_Chi_Minh"], { signal, stdin: JSON.stringify(list) });
      pages.push({
        name, url,
        reels: st.reels_analyzed, perWeek: st.reels_per_week,
        median: st.engagement?.median ?? 0, max: st.engagement?.max ?? 0, viral: st.viral?.count ?? 0,
        bestDay: bestGroup(st.by_weekday), bestTime: bestGroup(st.by_time_of_day), bestLength: bestGroup(st.by_duration),
        hashtags: (st.top_hashtags ?? []).slice(0, 5).map((h) => h.tag),
        top: (st.top ?? []).slice(0, 3).map((r) => ({ url: r.url, engagement: r.engagement, caption: String(r.caption ?? "").replace(/\s+/g, " ").slice(0, 120) })),
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      pages.push({ name, url, error: e.message });
    }
  }
  const ok = pages.filter((p) => !p.error);
  if (ok.length < 2) throw new Error(`Không đọc được đủ kênh để so sánh (${pages.filter((p) => p.error).map((p) => `@${p.name}`).join(", ")} lỗi). Kiểm tra lại link fanpage.`);
  await setPhase("AI đang so sánh các kênh…");
  return {
    fields: { compare: pages },
    prompt: [
      `So sánh ${ok.length} fanpage theo skill competitor-compare, bằng tiếng Việt. Giờ đăng tính theo ${TIME_ZONES[input.tz] ?? "giờ Việt Nam"}.${input.focus ? ` Người dùng muốn chú ý: ${input.focus}.` : ""}`,
      "Số liệu từng kênh (đã tính sẵn từ các reel gần nhất):",
      JSON.stringify(ok.map(({ url, ...p }) => p)),
      // Free models misread which number is bigger: state the leaders outright.
      `Kết luận đã kiểm tra, dùng đúng như sau: ${[
        ["đăng đều nhất", "perWeek", " reel mỗi tuần"],
        ["tương tác trung vị cao nhất", "median", ""],
        ["nhiều reel viral nhất", "viral", " reel viral"],
        ["có reel tốt nhất", "max", " tương tác"],
      ].map(([label, key, unit]) => {
        const lead = ok.reduce((a, p) => ((p[key] ?? 0) > (a[key] ?? 0) ? p : a), ok[0]);
        return `${label}: @${lead.name} (${lead[key]}${unit})`;
      }).join("; ")}. Kênh có tương tác trung vị thấp nhất: @${ok.reduce((a, p) => (p.median < a.median ? p : a), ok[0]).name}.`,
      pages.some((p) => p.error) ? `Không đọc được: ${pages.filter((p) => p.error).map((p) => `@${p.name}`).join(", ")} (nói ngắn gọn ở Tổng quan).` : "",
    ].filter(Boolean).join("\n\n"),
  };
}

/** Campaign: competitor's 3 best reels (watched) → reference for the week plan written by content-planner. */
async function campaignPrompt(job, { setPhase, signal }) {
  const { url } = job.input;
  await setPhase("Bước 1/3: đang quét kênh đối thủ…");
  const data = await runScript("fb-reel-reader", "list_reels.py", [url, "--count", "30", "--stats", "--limit", "10"], { signal });
  const reels = (data.reels ?? []).slice(0, 3);
  if (!reels.length) throw new Error("Không đọc được reel nào của kênh đối thủ. Kiểm tra lại link fanpage.");
  const { notes, log } = directEnabled()
    ? await watchAll(reels.map((r, k) => ({ url: r.url, line: reelLine(r, k, 160) })), { setPhase: (p) => setPhase(`Bước 2/3: ${p}`), signal })
    : { notes: reels.map((r, k) => reelLine(r, k, 300)), log: [] };
  await setPhase("Bước 3/3: AI đang lên kế hoạch và viết bài…");
  return {
    fields: { watch: log, learned: reels.map((r, k) => ({ url: r.url, caption: String(r.caption ?? "").replace(/\s+/g, " ").slice(0, 140), engagement: r.engagement, source: log[k]?.source ?? "caption" })) },
    direct: { skill: "content-planner" },
    prompt: [
      job.prompt,
      `HỌC TỪ ĐỐI THỦ: đây là ${reels.length} reel nhiều tương tác nhất của kênh ${url} (đã xem nội dung). Áp dụng hook, định dạng và góc tiếp cận đang hiệu quả vào các bài trong kế hoạch; KHÔNG chép câu chữ, câu chuyện hay số liệu của họ.`,
      notes.join("\n\n"),
    ].join("\n\n"),
  };
}

/**
 * Google Maps with Apify: the lowest and the highest rated reviews, so complaints and praise both come
 * from real low / high star reviews. The star histogram is not in Apify's data: it is read from the
 * Maps page in Chrome when the sidecar is up (best effort, the report works without it).
 */
async function mapsPromptApify(input, { setPhase, signal }) {
  await setPhase("Đang lấy đánh giá ít sao và nhiều sao nhất trên Google Maps…");
  const [place, page] = await Promise.all([
    fetchReviewsApify(input.place, { perSide: 30, signal }),
    fetchReviews(input.place, { max: 0, signal }).catch(() => null),
  ]);
  if (!place.low.length && !place.high.length) throw new Error(`Không đọc được bài đánh giá nào của ${place.name}.`);
  await setPhase(`Đã đọc ${place.low.length + place.high.length} đánh giá của ${place.name}, AI đang phân tích…`);
  const starCounts = page && Object.keys(page.starCounts ?? {}).length ? page.starCounts : null;
  return reviewSides(place, { site: "Google Maps", starCounts, focus: input.focus });
}

/** Prompt + scorecard fields from the lowest and highest rated reviews of one place (Google Maps or Yelp). */
function reviewSides(place, { site, starCounts = null, focus = "" }) {
  const line = (r) => `- (${r.stars ?? "?"} sao, ${r.when}${r.ownerReplied ? ", chủ quán đã trả lời" : ""}) ${r.text.slice(0, 160)}`;
  const prompt = [
    `Phân tích đánh giá ${site} của quán dưới đây theo skill review-analyzer, bằng tiếng Việt.`,
    `Quán: ${place.name}${place.address ? ` (${place.address})` : ""}. Điểm: ${place.rating || "?"} sao trên ${place.total || "?"} lượt đánh giá.`,
    starCounts ? `Phân bố số sao trên TOÀN BỘ đánh giá của ${site} (dùng cho bảng "Phân bố số sao"): ${[5, 4, 3, 2, 1].map((n) => `${n} sao: ${starCounts[n] ?? 0}`).join(", ")}.` : 'Không có phân bố số sao: bỏ mục "Phân bố số sao".',
    `ĐÁNH GIÁ ÍT SAO NHẤT (${place.low.length} bài, xếp từ điểm thấp nhất). Mục "Khách chê gì" lấy từ đây; "Số bài nhắc" không được lớn hơn ${place.low.length}:`,
    place.low.map(line).join("\n"),
    `ĐÁNH GIÁ NHIỀU SAO NHẤT (${place.high.length} bài, xếp từ điểm cao nhất). Mục "Khách khen gì" lấy từ đây; "Số bài nhắc" không được lớn hơn ${place.high.length}:`,
    place.high.map(line).join("\n"),
    "Ở Tổng quan, nói rõ đã đọc bao nhiêu bài ít sao và bao nhiêu bài nhiều sao (không phải toàn bộ đánh giá). Số bài nhắc phải là số nguyên, không ghi \"~\" hay \"khoảng\". Trích dẫn giữ nguyên ngôn ngữ gốc của review.",
    focus ? `Người dùng muốn chú ý thêm: ${focus}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    prompt,
    fields: { place: { name: place.name, rating: place.rating, total: place.total, address: place.address ?? "", url: place.url, starCounts, read: place.low.length + place.high.length, readLow: place.low.length, readHigh: place.high.length, source: "apify", site },
      // A few real low-star reviews, each with a "Soạn trả lời" button on the result page.
      lowReviews: place.low.filter((r) => (r.stars ?? 5) <= 3).slice(0, 6).map((r) => ({ stars: r.stars, when: r.when, text: r.text.slice(0, 600), ownerReplied: r.ownerReplied })) },
  };
}

/** Yelp: lowest and highest rated reviews through Apify, analysed like the Google Maps ones. */
async function yelpPrompt(input, { setPhase, signal }) {
  if (!socialEnabled()) throw new Error("Chưa cấu hình APIFY_REVIEWS_TOKEN trong deploy/.env: Yelp chỉ đọc được qua Apify (khoảng $0,06 mỗi lần).");
  await setPhase("Đang lấy review ít sao và nhiều sao nhất trên Yelp…");
  const place = await fetchYelpReviews(input.url, { perSide: 30, signal });
  await setPhase(`Đã đọc ${place.low.length + place.high.length} review Yelp của ${place.name}, AI đang phân tích…`);
  return reviewSides(place, { site: "Yelp", starCounts: place.starCounts, focus: input.focus });
}

/** Copy a remote picture into the clips folder (served at /media/thumbs/<name>); null when it fails. */
async function keepThumb(src, name, signal) {
  if (!src || !CLIPS_DIR) return null;
  try {
    const res = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(20_000)]) });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return null;
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(CLIPS_DIR, { recursive: true });
    await writeFile(path.join(CLIPS_DIR, name), Buffer.from(await res.arrayBuffer()));
    return name;
  } catch {
    return null;
  }
}

/** Instagram: latest posts through Apify, turned into the fanpage analyzer's numbers and report. */
async function instagramPrompt(input, { setPhase, signal }) {
  if (!socialEnabled()) throw new Error("Chưa cấu hình APIFY_REVIEWS_TOKEN trong deploy/.env: Instagram chỉ đọc được qua Apify (khoảng $0,07 mỗi lần).");
  await setPhase(`Đang đọc 40 bài gần nhất của @${input.user}…`);
  const { name, data } = await fetchInstagramPosts(input.user, { limit: 40, signal });
  await setPhase(`Đã đọc ${data.count} bài, đang tính số liệu…`);
  const stats = await runScript("fanpage-analyzer", "analyze_reels.py", ["--tz", input.tz ?? "Asia/Ho_Chi_Minh"], { signal, stdin: JSON.stringify(data) });
  // Post types matter on Instagram (reels vs photos vs albums): computed here, the analyzer only knows reels.
  const groups = {};
  for (const p of data.reels) (groups[p.kind] ??= []).push(p.reactions + 2 * p.comments);
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const byKind = Object.entries(groups).map(([kind, xs]) => ({ kind, posts: xs.length, median_engagement: median(xs) })).sort((a, b) => b.posts - a.posts);
  // Cards for the posts the report lists (top and bottom): keep a copy of each picture, Instagram's
  // links expire and cannot be shown from another site.
  const listed = new Set([...(stats.top ?? []), ...(stats.bottom ?? [])].map((r) => r.url));
  const igPosts = await Promise.all(data.reels.filter((p) => listed.has(p.url) && p.code).map(async (p) => ({
    url: p.url, code: p.code, kind: p.kind, likes: p.reactions, comments: p.comments,
    date: new Date(p.created_ts * 1000).toISOString().slice(0, 10), caption: String(p.caption ?? "").replace(/\s+/g, " ").slice(0, 160),
    image: await keepThumb(p.image, `ig-${p.code}.jpg`, signal),
  })));
  await setPhase("AI đang viết báo cáo…");
  return {
    direct: { skill: "fanpage-analyzer", from: /Step 2/ },
    fields: { igName: name, igPosts },
    prompt: [
      `Viết báo cáo phân tích tài khoản INSTAGRAM @${input.user} (${name}) theo đúng cấu trúc ở Step 3, bằng tiếng Việt. Đây là Instagram, không phải Facebook: gọi là "bài đăng" (gồm ảnh, album và video/reel), tương tác = lượt thích + 2 x bình luận (Instagram không cho xem lượt chia sẻ). Mọi giờ đăng tính theo ${TIME_ZONES[input.tz] ?? "giờ Việt Nam"}.${input.focus ? ` Chú ý thêm: ${input.focus}.` : ""}`,
      `Thêm vào mục "Video dài bao lâu, caption ra sao" một bảng "Loại bài | Số bài | Tương tác trung vị" từ số liệu này và nhận xét loại nào hiệu quả nhất: ${JSON.stringify(byKind)}. Không có số liệu độ dài video thì bỏ phần độ dài.`,
      "Số liệu đã tính sẵn (JSON, dùng đúng các con số này, không tự tính lại):",
      JSON.stringify(stats),
    ].join("\n\n"),
  };
}

/** Google Maps: collect recent reviews in the Chrome sidecar, count stars, send a trimmed sample. */
async function mapsPrompt(input, { setPhase, signal }) {
  if (apifyReviewsEnabled()) return mapsPromptApify(input, { setPhase, signal });
  await setPhase("Đang mở Google Maps…");
  const place = await fetchReviews(input.place, { max: 80, signal, onProgress: setPhase });
  if (!place.reviews.length) throw new Error(`Không đọc được bài đánh giá nào của ${place.name}.`);
  await setPhase(`Đã đọc ${place.reviews.length} đánh giá của ${place.name}, AI đang phân tích…`);
  const stars = [5, 4, 3, 2, 1].map((n) => `${n} sao: ${place.reviews.filter((r) => r.stars === n).length}`).join(", ");
  const all = Object.keys(place.starCounts ?? {}).length ? [5, 4, 3, 2, 1].map((n) => `${n} sao: ${place.starCounts[n] ?? 0}`).join(", ") : "";
  // Keep every low-star review (the complaints matter most) and fill the rest with the longest ones, inside the token budget.
  const withText = place.reviews.filter((r) => r.text);
  const low = withText.filter((r) => r.stars && r.stars <= 3);
  const high = withText.filter((r) => !r.stars || r.stars > 3).sort((a, b) => b.text.length - a.text.length);
  const sample = [...low.slice(0, 18), ...high].slice(0, 40);
  const lines = sample.map((r) => `- (${r.stars ?? "?"} sao, ${r.when}) ${r.text.slice(0, 170)}`);
  const prompt = [
    "Phân tích đánh giá Google Maps của quán dưới đây theo skill review-analyzer, bằng tiếng Việt.",
    `Quán: ${place.name}${place.address ? ` (${place.address})` : ""}. Điểm: ${place.rating || "?"} sao trên ${place.total || "?"} lượt đánh giá.`,
    all ? `Phân bố số sao trên TOÀN BỘ đánh giá của Google (dùng cho bảng "Phân bố số sao"): ${all}.` : "",
    `Đã đọc ${place.reviews.length} bài gần đây. Phân bố số sao trong các bài đã đọc: ${stars}. Có ${withText.length} bài có chữ, dưới đây là ${sample.length} bài tiêu biểu (giữ hết bài từ 3 sao trở xuống):`,
    lines.join("\n"),
    `"Số bài nhắc" là số bài trong ${place.reviews.length} bài đã đọc có nhắc tới ý đó: phải là số nguyên, KHÔNG lớn hơn ${place.reviews.length}, không ghi "~" hay "khoảng".`,
    input.focus ? `Người dùng muốn chú ý thêm: ${input.focus}` : "",
  ].filter(Boolean).join("\n\n");
  // The result page draws the scorecard from these numbers rather than from the AI's text.
  const counts = Object.keys(place.starCounts ?? {}).length ? place.starCounts : Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, place.reviews.filter((r) => r.stars === n).length]));
  return { prompt, fields: { place: { name: place.name, rating: place.rating, total: place.total, address: place.address, url: place.url, starCounts: counts, read: place.reviews.length }, lowReviews: low.slice(0, 6).map((r) => ({ stars: r.stars, when: r.when, text: r.text.slice(0, 600) })) } };
}

const SOURCE_RULE =
  'Mỗi reel có phần "ĐÃ XEM" ghi rõ nguồn: "video" (AI đã xem cả hình và tiếng), "lời thoại" (chỉ nghe được tiếng nói), "caption" (chưa xem được, chỉ có caption). "Nội dung chính" phải dựa vào phần ĐÃ XEM; reel nào chỉ có caption thì ghi rõ "⚠️ Chỉ dựa trên caption" ở reel đó. Không bịa thêm cảnh hay lời nói.';

const seenBlock = (seen) => (seen.text ? `ĐÃ XEM (nguồn: ${seen.source}):\n${seen.text}` : "ĐÃ XEM (nguồn: caption): chưa tải hoặc chưa xem được video, chỉ dùng caption ở trên.");

/** Watch reels 3 at a time; returns the notes for the prompt and a log row per reel (job.watch). */
let CLIPS_DIR = null; // set by createPreparer: where watched videos are kept for playback

async function watchAll(items, { setPhase, signal, label = "reel" }) {
  const notes = [];
  const log = [];
  let watched = 0;
  await setPhase(`AI đang xem ${items.length} ${label}…`);
  for (let i = 0; i < items.length; i += 3) {
    const batch = await Promise.all(
      items.slice(i, i + 3).map(async ({ url, line }) => {
        const seen = await watchReel(url, { signal, keepIn: CLIPS_DIR });
        await setPhase(`AI đã xem ${++watched}/${items.length} ${label}…`);
        return { note: `${line}\n${seenBlock(seen)}`, row: { url, source: seen.source, ms: seen.ms, clip: seen.clip } };
      }),
    );
    // Promise.all keeps input order, so log[k] always belongs to items[k] (the campaign card relies on it).
    notes.push(...batch.map((b) => b.note));
    log.push(...batch.map((b) => b.row));
  }
  return { notes, log };
}

/** Top reels to watch: by engagement, or (with a topic) the ones the model finds most on topic. */
async function pickReels(reels, input, signal) {
  const count = Math.min(input.top, reels.length);
  if (!input.topic || reels.length <= count) return reels.slice(0, count);
  try {
    const list = reels.map((r, i) => `${i + 1}. ${String(r.caption ?? "").replace(/\s+/g, " ").slice(0, 140)} (tương tác ${r.engagement ?? 0})`).join("\n");
    const msg = await complete(
      { messages: [{ role: "user", content: `Chủ đề: "${input.topic}". Chọn ${count} reel liên quan nhất tới chủ đề, ưu tiên tương tác cao. Chỉ trả về các số thứ tự cách nhau bằng dấu phẩy, không viết gì khác.\n\n${list}` }] },
      { signal, maxTokens: 400 },
    );
    const nums = [...new Set((msg.content ?? "").match(/\d+/g)?.map(Number) ?? [])].filter((n) => n >= 1 && n <= reels.length);
    if (nums.length) return nums.slice(0, count).map((n) => reels[n - 1]);
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  return reels.slice(0, count);
}

/**
 * Scan jobs without a GoClaw agent: run the skill's own scripts here, then the model only writes the
 * report (llm.runSkill with the report part of the same SKILL.md). Returns null when not handled.
 */
async function scanDirect(job, { setPhase, signal }) {
  const input = job.input ?? {};
  if (job.type === "threads") {
    await setPhase("Đang quét Threads…");
    const args = [...input.keywords.flatMap((k) => ["--search", k]), ...input.profiles.flatMap((p) => ["--profile", p]), "--limit", String(Math.min(30, input.top + 8))];
    if (input.days) args.push("--days", String(input.days));
    const data = await runScript("threads-viral-finder", "threads_scan.py", args, { signal });
    const posts = data.posts ?? [];
    if (!posts.length) throw new Error("Không tìm thấy bài Threads nào phù hợp. Thử từ khoá khác hoặc khoảng thời gian dài hơn.");
    await setPhase(`Đã quét ${data.scanned ?? posts.length} bài, AI đang chọn và phân tích…`);
    const target = [...input.keywords.map((k) => `"${k}"`), ...input.profiles].join(", ");
    return {
      direct: { skill: "threads-viral-finder", from: /Step 2/ },
      prompt: [
        `Báo cáo ${input.top} bài Threads viral nhất cho ${target}${input.days ? ` trong ${input.days} ngày gần đây` : ""}, bằng tiếng Việt. Đã quét ${data.scanned ?? posts.length} bài, dưới đây là ${Math.min(posts.length, 15)} bài nhiều tương tác nhất (xếp sẵn, số liệu chính xác):`,
        posts.slice(0, 15).map(threadLine).join("\n"),
        `Bỏ những bài không thật sự nói về ${target} (tìm kiếm của Threads khớp khá lỏng), spam và quảng cáo; nếu còn ít hơn ${input.top} bài thì chỉ báo cáo số bài còn lại. Dòng đầu viết bằng tiếng Việt, ví dụ: "Đã quét 18 bài cho ${target}, giữ lại 5 bài nổi bật nhất." Tiêu đề các mục và nhãn chỉ dùng tiếng Việt (ví dụ "Vì sao viral:", "Pattern chung", "Ý tưởng cho bạn").`,
      ].join("\n\n"),
    };
  }

  if (job.type === "fb-reels") {
    if (input.mode === "reel") {
      const id = input.url.match(/\/(?:reel|videos)\/(\d{6,25})|[?&]v=(\d{6,25})/)?.slice(1).find(Boolean);
      if (!id) return null; // fb.watch / share links: only the agent's browser can resolve them
      await setPhase("Đang đọc reel…");
      const data = await runScript("fb-reel-reader", "list_reels.py", ["--ids", id, "--limit", "1"], { signal });
      const reel = data.reels?.[0];
      if (!reel) throw new Error("Không đọc được reel này. Reel có thể đã bị xoá hoặc ở chế độ riêng tư.");
      await setPhase("AI đang xem reel…");
      const seen = await watchReel(reel.url, { signal, keepIn: CLIPS_DIR });
      return {
        fields: { watch: [{ url: reel.url, source: seen.source, ms: seen.ms, clip: seen.clip }] },
        direct: { skill: "fb-reel-reader", from: /Step 4/ },
        prompt: [
          `Phân tích reel Facebook này theo mục "Single reel", bằng tiếng Việt. ${SOURCE_RULE}`,
          reelLine(reel, 0, 1200) + `\nNgười đăng: ${reel.owner ?? ""}${reel.music ? ` · âm thanh: ${reel.music}` : ""}`,
          seenBlock(seen),
        ].join("\n\n"),
      };
    }
    await setPhase(`Đang quét ${input.depth} reel gần nhất…`);
    const data = await runScript("fb-reel-reader", "list_reels.py", [input.url, "--count", String(input.depth), "--stats", "--limit", "30"], { signal });
    const reels = data.reels ?? [];
    if (!reels.length) throw new Error("Không đọc được reel nào của kênh này. Kênh có thể riêng tư hoặc chưa có reel.");
    const scanned = data.scanned ?? data.count ?? reels.length; // scanned = reels read; count = reels kept
    await setPhase(`Đã quét ${scanned} reel, AI đang chọn ra ${input.top} reel đáng học…`);
    const picked = await pickReels(reels.slice(0, 14), input, signal);
    const { notes, log } = await watchAll(picked.map((r, k) => ({ url: r.url, line: reelLine(r, k) })), { setPhase, signal });
    return {
      fields: { watch: log },
      direct: { skill: "fb-reel-reader", from: /Step 4/ },
      prompt: [
        `Báo cáo theo mục "Channel mode" cho ${picked.length} reel dưới đây (đã chọn sẵn${input.topic ? ` theo chủ đề "${input.topic}"` : ""}, giữ đúng thứ tự), kênh ${input.url}, bằng tiếng Việt. Đã quét ${scanned} reel gần nhất${scanned < input.depth ? " (đó là toàn bộ reel của kênh)" : ""}. ${SOURCE_RULE}`,
        notes.join("\n\n"),
        `Dòng kết: đã quét ${scanned} reel, đã xem ${picked.length} reel, và nguồn phân tích đã dùng (video, lời thoại hay chỉ caption).`,
      ].join("\n\n"),
    };
  }

  if (job.type === "fanpage") {
    await setPhase("Đang đọc 100 reel gần nhất của fanpage…");
    const list = await runScript("fanpage-analyzer", "list_reels.py", [input.url, "--count", "100", "--stats", "--limit", "200"], { signal });
    await setPhase(`Đã đọc ${list.count ?? list.reels?.length ?? 0} reel, đang tính số liệu…`);
    const stats = await runScript("fanpage-analyzer", "analyze_reels.py", ["--tz", input.tz ?? "Asia/Ho_Chi_Minh"], { signal, stdin: JSON.stringify(list) });
    await setPhase("AI đang viết báo cáo…");
    return {
      direct: { skill: "fanpage-analyzer", from: /Step 2/ },
      prompt: [
        `Viết báo cáo phân tích fanpage ${input.url} theo đúng cấu trúc ở Step 3, bằng tiếng Việt. Mọi giờ đăng tính theo ${TIME_ZONES[input.tz] ?? "giờ Việt Nam"}, ghi rõ điều này ở mục "Đăng khi nào".${input.focus ? ` Chú ý thêm: ${input.focus}.` : ""}`,
        "Số liệu đã tính sẵn (JSON, dùng đúng các con số này, không tự tính lại):",
        JSON.stringify(stats),
      ].join("\n\n"),
    };
  }

  if (job.type === "clone" && input.source === "url") {
    await setPhase("Đang đọc 30 reel gần nhất của kênh đối thủ…");
    const data = await runScript("channel-cloner", "list_reels.py", [input.url, "--count", "30", "--stats", "--limit", String(Math.min(input.count + 5, 20))], { signal });
    const reels = data.reels ?? [];
    if (!reels.length) throw new Error("Không đọc được bài nào của kênh đối thủ. Thử dán nội dung bài viết thay cho link.");
    await setPhase(`Đã đọc ${data.count ?? reels.length} bài, AI đang viết ${input.count} bài mới…`);
    const [, ...rest] = job.prompt.split("\n\n"); // keep the user's channel, brief, tone and pillars from buildJob
    return {
      direct: { skill: "channel-cloner", from: /Step 2/ },
      prompt: [
        `Nhân bản kênh: viết ${input.count} bài MỚI cho kênh của tôi, học từ content gốc của đối thủ, theo đúng "Output format". Đã đọc ${data.count ?? reels.length} bài của kênh ${input.url}, đây là ${Math.min(reels.length, input.count + 3)} bài nhiều tương tác nhất:`,
        reels.slice(0, input.count + 3).map((r, i) => reelLine(r, i, 240)).join("\n"),
        ...rest.filter((part) => !/^Content gốc:/.test(part)),
      ].join("\n\n"),
    };
  }
  return null;
}

/**
 * Work the server does before the model writes: collect data (TikTok, Google Maps, competitor pages,
 * scans run here when Groq is set), watch videos, or, with the optional Apify backup, bake the
 * 100-reel list into the prompt. Without data work the plain prompt is used.
 *
 * @returns {Promise<{ prompt: string, notice?: string, fields?: object, direct?: { skill: string, from?: RegExp } }>}
 */
export function createPreparer({ facebook, mock = false, clipsDir = null, log = console }) {
  CLIPS_DIR = clipsDir;
  return async function prepare(job, { setPhase, signal }) {
    const input = job.input ?? {};
    // Demo mode answers from canned replies: do not open Chrome, search the web or run scripts.
    if (mock && ["tiktok", "maps", "compare", "campaign", "yelp", "instagram"].includes(job.type)) return { prompt: job.prompt || job.title };
    if (job.type === "tiktok") return tiktokPrompt(input, { setPhase, signal });
    if (job.type === "yelp") return yelpPrompt(input, { setPhase, signal });
    if (job.type === "instagram") return instagramPrompt(input, { setPhase, signal });
    if (job.type === "maps") return mapsPrompt(input, { setPhase, signal });
    if (job.type === "compare") return comparePrompt(input, { setPhase, signal });
    if (job.type === "campaign") return campaignPrompt(job, { setPhase, signal });
    if (directEnabled() && !mock) {
      const scanned = await scanDirect(job, { setPhase, signal });
      if (scanned) return scanned;
    }
    if (job.type !== "fb-reels" || input.mode !== "channel" || input.depth !== 100) return { prompt: job.prompt };

    if (!facebook.enabled) return { prompt: job.prompt }; // default: the skill pages the reels itself, free
    await setPhase("Đang lấy danh sách 100 reel mới nhất…");
    try {
      const { ids, cached } = await facebook.latestReelIds(input.url, 100, { signal });
      if (!ids.length) {
        return { prompt: job.prompt, notice: "Nguồn dữ liệu dự phòng không trả về reel nào, đã chuyển sang quét trực tiếp." };
      }
      await setPhase(`Đã có ${ids.length} reel${cached ? " (từ bộ nhớ đệm)" : ""}. AI đang xếp hạng và xem video…`);
      return { prompt: channelPromptWithIds(input, ids) };
    } catch (e) {
      if (signal?.aborted) throw e;
      log.warn?.(`prepare ${job.id}: reel list failed: ${e.message}`);
      return { prompt: job.prompt, notice: `Nguồn dữ liệu dự phòng lỗi (${e.message}), đã chuyển sang quét trực tiếp.` };
    }
  };
}
