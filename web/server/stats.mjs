// Admin money page: what the shops paid (Stripe top-ups kept on each user), what the credits were spent on,
// and a rough running cost per tool (model tokens + GPU time) next to what those credits brought in.

/** Rough cost of the model: USD per 1M tokens, input and output blended (Groq gpt-oss-120b). */
export const TOKEN_USD = Number(process.env.COST_TOKEN_USD_PER_M) || 0.5;
/** Rough GPU cost of one finished run, USD (Kaggle / rented GPU time per run). */
export const GPU_USD = { video: 0.02, image: 0.01, "photo-fix": 0.004, "reel-cut": 0.01, dub: 0.01, "live-recap": 0.01 };

const LIVE = new Set(["queued", "running", "review"]);

/**
 * @param {{ users: object[], jobs: object[], today: string, dayOf: (iso: string) => string, days?: number }} p
 */
export function moneyStats({ users, jobs, today, dayOf, days = 30 }) {
  const payments = [];
  for (const u of users) for (const p of u.payments ?? []) payments.push({ ...p, userId: u.id });
  // Money: everything paid, minus top-ups a bank took back and the shop did not win.
  const lost = (p) => p.disputed && p.disputeClosed !== "won";
  const gross = payments.reduce((a, p) => a + (p.amount ?? 0), 0);
  const disputed = payments.filter(lost).reduce((a, p) => a + (p.amount ?? 0), 0);
  const creditsSold = payments.filter((p) => !lost(p)).reduce((a, p) => a + (p.credits ?? 0), 0);
  const payers = new Set(payments.filter((p) => !lost(p)).map((p) => p.userId));
  const members = users.filter((u) => u.role !== "admin");
  const base = Date.parse(`${today}T00:00:00Z`);
  const daily = [];
  for (let k = days - 1; k >= 0; k--) daily.push({ day: new Date(base - k * 86_400_000).toISOString().slice(0, 10), amount: 0, count: 0 });
  const at = Object.fromEntries(daily.map((d, i) => [d.day, i]));
  for (const p of payments) {
    const i = at[dayOf(p.at)];
    if (i === undefined || lost(p)) continue;
    daily[i].amount += p.amount ?? 0;
    daily[i].count++;
  }
  // Usage per tool over the cached jobs: credits really taken (refunds left out), tokens, rough cost.
  const centsPerCredit = creditsSold ? (gross - disputed) / creditsSold : 0;
  const byType = {};
  for (const j of jobs) {
    if (!j.type || j.type === "watch" || j.type === "combo") continue;
    const t = (byType[j.type] ??= { type: j.type, runs: 0, done: 0, failed: 0, credits: 0, tokens: 0, costUsd: 0 });
    t.runs++;
    if (j.status === "done") t.done++;
    else if (j.status === "failed") t.failed++;
    if (j.credits && !j.refunded && !LIVE.has(j.status)) t.credits += j.credits;
    const tokens = Number(j.usage?.total_tokens) || 0;
    t.tokens += tokens;
    t.costUsd += (tokens / 1e6) * TOKEN_USD + (j.status === "done" ? GPU_USD[j.type] ?? 0 : 0);
  }
  // Most credits spent are free ones (sign-up trial, credits the admin added): only the paid share of them
  // earned money. Credits ever handed out = spent + still on the accounts; paid share = sold / that.
  const balance = members.reduce((a, u) => a + (typeof u.credits === "number" ? u.credits : 0), 0);
  const spent = Object.values(byType).reduce((a, t) => a + t.credits, 0);
  const paidShare = creditsSold ? Math.min(1, creditsSold / Math.max(1, spent + balance)) : 0;
  const tools = Object.values(byType)
    .map((t) => ({ ...t, costUsd: +t.costUsd.toFixed(4), earnedCents: Math.round(t.credits * centsPerCredit * paidShare) }))
    .sort((a, b) => b.credits - a.credits || b.runs - a.runs);
  const costUsd = tools.reduce((a, t) => a + t.costUsd, 0);
  return {
    currency: payments[0]?.currency ?? "usd",
    revenue: { gross, disputed, net: gross - disputed, payments: payments.length, payers: payers.size, members: members.length },
    credits: { sold: creditsSold, balance, centsPerCredit: +centsPerCredit.toFixed(2), paidShare: +paidShare.toFixed(3) },
    daily,
    tools,
    cost: { usd: +costUsd.toFixed(2), tokenUsdPerM: TOKEN_USD, gpuUsd: GPU_USD, jobs: jobs.length },
    recent: payments
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 10)
      .map((p) => ({ at: p.at, amount: p.amount ?? 0, currency: p.currency, credits: p.credits, email: users.find((u) => u.id === p.userId)?.email ?? "", disputed: !!p.disputed, disputeClosed: p.disputeClosed ?? null })),
  };
}
