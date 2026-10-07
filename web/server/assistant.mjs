// The in-app assistant: product knowledge + page context in the system prompt; it answers,
// and when the user wants a task done it proposes ONE action block that the UI shows as a
// confirm card (nothing runs until the user clicks).

import { SKILLS } from "../client/src/lib/constants.js";
import { GUIDE } from "../client/src/lib/skillGuide.js";
import { FAQ, FLOWS } from "../client/src/lib/workflows.js";
import { buildJob, InputError } from "./prompts.mjs";
import { complete, directEnabled } from "./llm.mjs";

const INPUTS = {
  "fb-reels": 'url (link kênh/fanpage hoặc 1 reel, bắt buộc), topic (chủ đề, tuỳ chọn), top (1 đến 10, mặc định 5), depth (10 hoặc 100, mặc định 100)',
  threads: "keywords (mảng tối đa 4 từ khoá) và/hoặc profiles (mảng @tài khoản, tối đa 5), days (0 = tất cả, mặc định 30), top (3 đến 30, mặc định 10)",
  write: "platform (facebook | threads | tiktok | ads), topic (bắt buộc), brief, tone, variants (1 đến 5)",
  clone: 'source ("url" hoặc "posts"), url hoặc posts, topic (kênh của người dùng, bắt buộc), count (6, 9 hoặc 12), platform (facebook | threads | tiktok)',
  fanpage: "url (link fanpage, bắt buộc), focus (điều muốn tìm hiểu, tuỳ chọn)",
  livestream: 'products (chuỗi, mỗi dòng một sản phẩm, bắt buộc), minutes (30 | 60 | 90), platform (facebook | tiktok), offer (ưu đãi có thật)',
  image: 'topic (bắt buộc), size ("1:1" | "4:5" | "9:16" | "16:9"), count (1 | 2 | 4), style (real | cinematic | pixar | anime | clay | cyberpunk)',
  plan: 'topic (kênh, bắt buộc), start (YYYY-MM-DD, bắt buộc), days (7 | 14), perDay (1 | 2), platform (facebook | threads | tiktok)',
  video: 'mode "topic", topic (bắt buộc), seconds (15 | 30 | 45 | 60), ratio ("9:16" | "16:9" | "1:1"), engine ("wan" | "ltx")',
};

function knowledge() {
  const tools = SKILLS.map((s) => {
    const g = GUIDE[s.id];
    const lines = [`- ${s.title} (${s.status === "soon" ? "SẮP CÓ, chưa dùng được" : `trang ${s.path}${s.type ? `, loại "${s.type}"` : ""}, mất ${s.eta}`}): ${s.pitch}`];
    if (g) lines.push(`  Kết quả: ${g.output.join("; ")}.`);
    if (s.type && INPUTS[s.type]) lines.push(`  Thông tin cần: ${INPUTS[s.type]}.`);
    return lines.join("\n");
  });
  return [
    "CÔNG CỤ:", ...tools,
    "", "QUY TRÌNH GỢI Ý:", ...FLOWS.map((f) => `- ${f.title}: ${f.hint}`),
    "", "HỎI ĐÁP:", ...FAQ.map(([, q, a]) => `- ${q} ${a}`),
    "", "KHÁC: Lịch sử (/history) lưu mọi lần chạy. Thư viện (/library) có mẫu PAS, AIDA… và bài đã lưu. ⌘K để tìm nhanh. Tạo ảnh và video cần kết nối GPU Kaggle ở trang tương ứng.",
  ].join("\n");
}

const today = () => new Date().toISOString().slice(0, 10);

export function systemPrompt(context = {}) {
  const parts = [
    `Bạn là "Trợ lý Skipli", trợ lý trong web Skipli Content: bộ công cụ content cho nhà bán hàng và nhà hàng Việt Nam. Hôm nay là ${today()}.`,
    "Trả lời tiếng Việt, ngắn gọn, thân thiện, dùng Markdown nhẹ (gạch đầu dòng, in đậm). Không dùng dấu gạch ngang (– hoặc —) để nối ý, dùng dấu hai chấm hoặc dấu phẩy. Không nhắc tên công nghệ bên trong (GoClaw, API, script, model).",
    "Bạn làm được 4 việc: (1) giải thích sản phẩm và cách dùng từng công cụ; (2) tư vấn content, marketing nhà hàng và bán hàng; (3) trả lời câu hỏi kiến thức chung (người nổi tiếng, chương trình, sự kiện, xu hướng...) bằng hiểu biết của bạn; (4) khi người dùng muốn chạy một công cụ, đề xuất đúng MỘT hành động.",
    "Câu hỏi thông tin (ai, cái gì, là gì, khi nào, vì sao...) thì TRẢ LỜI TRỰC TIẾP, không đề xuất công cụ. Nếu thông tin có thể đã cũ hoặc bạn không chắc thì nói rõ, đừng bịa. Chỉ được gợi ý thêm 1 câu ngắn về công cụ liên quan ở cuối nếu thật sự hữu ích, không kèm khối action.",
    "Cách đề xuất hành động: viết 1 câu giải thích, rồi một khối duy nhất ở cuối câu trả lời:",
    '```action\n{"type": "<loại công cụ>", "input": { ...các thông tin cần... }}\n```',
    "QUAN TRỌNG: Khi người dùng NHỜ LÀM (động từ như quét, tìm bài, phân tích, viết, tạo, lên lịch) và yêu cầu quét kênh, phân tích fanpage, tìm bài viral, viết bài, nhân bản kênh, viết kịch bản livestream, tạo ảnh, tạo video hoặc lên lịch, KHÔNG tự làm trong khung chat (không tự viết bài, không tự phân tích): luôn đề xuất khối action của công cụ tương ứng để người dùng bấm Chạy. Khi người dùng hỏi có công cụ nào làm được việc gì, chỉ giới thiệu công cụ CỦA WEB NÀY (danh sách bên dưới), không giới thiệu phần mềm bên ngoài.",
    "Chỉ cần đủ thông tin BẮT BUỘC là đề xuất ngay, KHÔNG hỏi thêm thông tin tuỳ chọn (brief, tone, số lượng...): tự điền từ những gì người dùng đã nói, còn lại để mặc định. Thiếu thông tin bắt buộc thì mới hỏi lại (ví dụ xin link fanpage). Không bịa link, giá hay ưu đãi. Công cụ SẮP CÓ thì nói rõ là chưa dùng được và gợi ý cách khác. Không tự nói là đã chạy: người dùng sẽ bấm nút để chạy.",
    "",
    knowledge(),
  ];
  if (context.path) parts.push("", `NGƯỜI DÙNG ĐANG Ở TRANG: ${context.path}`);
  if (context.job) {
    const j = context.job;
    parts.push(`KẾT QUẢ ĐANG MỞ: "${j.title}" (loại ${j.type}, trạng thái ${j.status}). Nếu người dùng hỏi "kết quả này", "reel nào", "bài nào" là nói về nội dung dưới đây:`, "<<<KẾT QUẢ", String(j.result ?? "(chưa có)").slice(0, 7000), "KẾT QUẢ>>>");
  }
  return parts.join("\n");
}

/** Pull the action block out of the answer and check it with the same validation as the forms. */
export function extractAction(content, refs) {
  const m = String(content).match(/```action\s*([\s\S]*?)```/);
  const text = String(content).replace(/```action\s*[\s\S]*?```/, "").trim();
  if (!m) return { text, action: null };
  let action;
  try {
    action = JSON.parse(m[1]);
  } catch {
    return { text, action: null };
  }
  const skill = SKILLS.find((s) => s.type === action?.type && s.status !== "soon");
  if (!skill) return { text, action: null };
  const input = action.input && typeof action.input === "object" ? action.input : {};
  try {
    const job = buildJob(action.type, input, refs);
    return { text, action: { type: action.type, input, title: job.title, skill: skill.title, path: skill.path, tone: skill.tone, valid: true } };
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    return { text, action: { type: action.type, input, skill: skill.title, path: skill.path, tone: skill.tone, valid: false, error: e.message } };
  }
}

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_web",
    description: "Tìm trên Google/web khi câu hỏi cần thông tin thực tế: người nổi tiếng, chương trình, sự kiện, giá, tin mới, xu hướng. Không dùng cho câu hỏi về Skipli Content.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Từ khoá tìm kiếm ngắn" } }, required: ["query"] },
  },
};

/** Top results from DuckDuckGo's HTML page (free, no key): a few short snippets keep the token cost low. */
async function searchWeb(query) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
  const page = await res.text();
  const clean = (t) => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const titles = [...page.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => clean(m[1]));
  const snippets = [...page.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => clean(m[1]));
  const lines = snippets.slice(0, 6).map((sn, k) => `${k + 1}. ${titles[k] ?? ""}: ${sn.slice(0, 300)}`);
  return lines.length ? lines.join("\n") : "Không tìm thấy kết quả.";
}

// The UI avoids dashes joining ideas ("Món A – mô tả"): turn them into a colon.
const noDash = (t) => t.replace(/\s+[–—]\s+/g, ": ");

export async function askDirect({ system, messages, signal }) {
  if (!directEnabled()) return null;
  const opts = { signal, waitMs: 6000 };
  const turns = [{ role: "system", content: system }, ...messages];
  const first = await complete({ messages: turns, tools: [SEARCH_TOOL], tool_choice: "auto" }, opts);
  let calls = first.tool_calls ?? [];
  // Some fallback models write the tool call as plain text instead: search the user's question then.
  if (!calls.length && /<tool_call>|<function=/.test(first.content ?? "")) {
    calls = [{ id: "call_0", type: "function", function: { name: "search_web", arguments: JSON.stringify({ query: messages.at(-1).content.slice(0, 200) }) } }];
    first.content = "";
  }
  if (!calls.length) return noDash(first.content ?? "");
  const queries = calls.slice(0, 2).map((c) => {
    try {
      return String(JSON.parse(c.function.arguments).query ?? "");
    } catch {
      return "";
    }
  });
  const found = await Promise.all(queries.map((q) => searchWeb(q || messages.at(-1).content).catch(() => "Không tìm được trên web lúc này.")));
  // Second pass is a plain question with the results pasted in: no tools (so no second tool call)
  // and a short system prompt, which keeps both calls inside the free per-minute token budget.
  const brief = `Bạn là "Trợ lý Skipli". Trả lời tiếng Việt, ngắn gọn, thân thiện, Markdown nhẹ, dựa trên kết quả tìm kiếm được cung cấp. Kết quả không đủ rõ thì nói là chưa chắc, không bịa. Không ghi ký hiệu trích dẫn, không dùng dấu gạch ngang để nối ý. Hôm nay là ${today()}.`;
  const ask = `${messages.at(-1).content}\n\nKẾT QUẢ TÌM KIẾM:\n${found.map((f, k) => `[${queries[k]}]\n${f}`).join("\n\n")}`;
  const second = await complete({ messages: [{ role: "system", content: brief }, ...messages.slice(-5, -1), { role: "user", content: ask }] }, opts);
  return noDash((second.content ?? "").replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, "").trim());
}
