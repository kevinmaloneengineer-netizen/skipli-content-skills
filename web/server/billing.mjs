// Credits and Stripe top-ups (ACCOUNTS=1 with SIGNUP=1): a customer signs up, gets TRIAL_CREDITS to try
// the tools, and buys more through Stripe Checkout. Each run takes credits by type (CREDIT_COST) when it
// starts, and gives them back when it fails or is canceled. Users without a `credits` number (the admin,
// accounts the admin made before billing) are not metered.
//
// Stripe is called over plain HTTPS (no SDK): one Checkout Session per top-up, then the
// checkout.session.completed webhook (or the success page asking /billing/confirm) adds the credits once.
// Chargebacks: charge.dispute.created takes the payment's credits back (an account that already spent
// them is locked); charge.dispute.closed with the dispute won gives them back and unlocks it.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Credits a run takes: GPU and video work costs more than a written post. */
export const CREDIT_COST = {
  video: 5,
  "video-restyle": 1, // same photos, another template: no GPU drawing
  image: 2,
  "reel-cut": 4,
  dub: 4,
  "live-recap": 4,
  "fb-reels": 2,
  threads: 2,
  tiktok: 2,
  maps: 2,
  yelp: 2,
  instagram: 2,
  fanpage: 2,
  compare: 3,
  clone: 2,
  campaign: 2,
  combo: 0, // its steps take their own credits
  "photo-fix": 1, // server-side photo grading, no model
  "gbp-post": 1,
  "menu-scan": 1, // a menu photo read by Gemini, taken only when dishes come back
  "zalo-message": 1,
  "promo-plan": 1,
  "sales-insight": 1,
  "delivery-menu": 1,
  "us-occasions": 1,
  "nextdoor-post": 1,
  nearby: 2, // 15 to 25 places read on Google Maps
  "review-compare": 3, // two review reads per place, up to 5 places
  trends: 2, // two Google Trends reads
};
export const costOf = (type) => CREDIT_COST[type] ?? 1;

/** "100:900,300:2400" → packs of credits and their price in cents. */
export function parsePacks(text) {
  return String(text)
    .split(",")
    .map((x) => x.trim().split(":").map(Number))
    .filter(([credits, cents]) => credits > 0 && cents >= 50)
    .map(([credits, cents]) => ({ id: `p${credits}`, credits, cents }));
}

export class BillingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Stripe-Signature check: "t=<unix>,v1=<hex>" signs `${t}.${raw body}` with the webhook secret.
 * Events older than 5 minutes are refused (replays).
 */
export function verifySignature(raw, header, secret, now = Date.now()) {
  const items = String(header ?? "").split(",");
  const t = items.find((p) => p.startsWith("t="))?.slice(2);
  const all = items.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !all.length || !secret) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex"));
  return all.some((sig) => {
    const got = Buffer.from(sig);
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

/** Stripe's form encoding: nested keys as a[b][c]=v. */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

/**
 * @param {{ store, env?: object, fetchFn?: typeof fetch }} opts
 */
export function createBilling({ store, env = process.env, fetchFn = fetch }) {
  // The admin can change the trial credits and the packs on the web (store settings); env is the default.
  const secret = env.STRIPE_SECRET_KEY ?? "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";
  const defaultTrial = Number.isFinite(Number(env.TRIAL_CREDITS)) && env.TRIAL_CREDITS !== "" && env.TRIAL_CREDITS !== undefined ? Number(env.TRIAL_CREDITS) : 20;
  const defaultPacks = env.CREDIT_PACKS || "100:900,300:2400,1000:6900";
  const saved = () => store.getSettings?.() ?? {};
  const trialNow = () => (typeof saved().trialCredits === "number" ? saved().trialCredits : defaultTrial);
  const packsNow = () => parsePacks(saved().creditPacks || defaultPacks);
  const currency = (env.STRIPE_CURRENCY || "usd").toLowerCase();

  async function stripe(method, path, body) {
    const res = await fetchFn(`https://api.stripe.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: body ? form(body).toString() : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new BillingError(502, `Stripe: ${data.error?.message ?? res.status}`);
    return data;
  }

  const metered = (user) => !!user && user.role !== "admin" && typeof user.credits === "number";

  /** Credits from a paid Checkout Session, once per session id. */
  async function credit(session) {
    if (session?.payment_status !== "paid") return { added: 0 };
    const user = store.getUser(session.client_reference_id ?? "");
    const credits = Number(session.metadata?.credits);
    if (!user || !(credits > 0)) return { added: 0 };
    const payments = user.payments ?? [];
    if (payments.some((p) => p.id === session.id)) return { added: 0, user };
    const entry = { id: session.id, credits, amount: session.amount_total ?? null, currency: session.currency ?? currency, at: new Date().toISOString(), ...(session.payment_intent ? { paymentIntent: session.payment_intent } : {}) };
    const updated = await store.updateUser(user.id, { credits: (user.credits ?? 0) + credits, payments: [entry, ...payments].slice(0, 100) });
    return { added: credits, user: updated };
  }

  /** The account and payment a dispute is about: by payment intent, else asking Stripe which session it was. */
  async function paymentOf(dispute) {
    const pi = typeof dispute?.payment_intent === "string" ? dispute.payment_intent : dispute?.payment_intent?.id;
    if (!pi) return null;
    for (const u of store.listUsers()) {
      const p = (u.payments ?? []).find((x) => x.paymentIntent === pi);
      if (p) return { user: u, payment: p };
    }
    // Payments recorded before the intent was kept: Stripe knows the Checkout Session of that intent.
    if (!secret) return null;
    const found = await stripe("GET", `/checkout/sessions?payment_intent=${encodeURIComponent(pi)}&limit=1`).catch(() => null);
    const session = found?.data?.[0];
    const user = session && store.getUser(session.client_reference_id ?? "");
    const payment = user && (user.payments ?? []).find((x) => x.id === session.id);
    return payment ? { user, payment: { ...payment, paymentIntent: pi } } : null;
  }

  /** A customer asked their bank for the money back: take back the credits of that top-up, once. */
  async function disputeOpened(dispute) {
    const hit = await paymentOf(dispute);
    if (!hit || hit.payment.disputed) return { handled: false };
    const { user, payment } = hit;
    const balance = user.credits ?? 0;
    const left = balance - payment.credits;
    const taken = Math.min(balance, payment.credits); // what actually comes off the balance
    const payments = (user.payments ?? []).map((p) => (p.id === payment.id ? { ...p, paymentIntent: payment.paymentIntent, disputed: dispute.id, disputedAt: new Date().toISOString(), takenBack: taken } : p));
    // Already spent: the balance cannot go below zero, so the account is locked until the dispute ends.
    await store.updateUser(user.id, { credits: Math.max(0, left), payments, ...(left < 0 ? { disabled: true, disabledReason: "dispute" } : {}) });
    return { handled: true, userId: user.id, taken, locked: left < 0 };
  }

  /** The dispute ended. Won (the money stays with the shop): the credits and the account come back. */
  async function disputeClosed(dispute) {
    const hit = await paymentOf(dispute);
    if (!hit || hit.payment.disputed !== dispute.id || hit.payment.disputeClosed) return { handled: false };
    const { user, payment } = hit;
    const won = dispute.status === "won";
    const payments = (user.payments ?? []).map((p) => (p.id === payment.id ? { ...p, disputeClosed: dispute.status, disputeClosedAt: new Date().toISOString() } : p));
    const patch = { payments };
    if (won) {
      patch.credits = (user.credits ?? 0) + (payment.takenBack ?? 0); // what was taken off the balance

      if (user.disabledReason === "dispute") Object.assign(patch, { disabled: false, disabledReason: null });
    }
    await store.updateUser(user.id, patch);
    return { handled: true, won };
  }

  return {
    enabled: !!secret,
    get trial() {
      return trialNow();
    },
    get packs() {
      return packsNow();
    },
    defaults: { trialCredits: defaultTrial, creditPacks: defaultPacks },
    currency,
    metered,
    costOf,

    /** Job middleware: enough credits for this run (checked again in charge, which is synchronous). */
    check(user, type) {
      if (!metered(user)) return;
      const cost = costOf(type);
      if (user.credits < cost) throw new BillingError(402, `Hết credit: lượt này cần ${cost} credit, bạn còn ${user.credits}. Nạp thêm ở trang Credit nhé.`);
    },

    /** Take the run's credits; returns the amount to note on the job (null when not metered). */
    async charge(user, type) {
      if (!metered(user)) return null;
      const cost = costOf(type);
      const fresh = store.getUser(user.id);
      if (fresh.credits < cost) throw new BillingError(402, `Hết credit: lượt này cần ${cost} credit, bạn còn ${fresh.credits}. Nạp thêm ở trang Credit nhé.`);
      await store.updateUser(user.id, { credits: fresh.credits - cost });
      return cost;
    },

    /** A run that failed or was canceled gives its credits back (once: the job is marked refunded). */
    async refund(job) {
      if (!job?.credits || job.refunded || !job.userId) return false;
      const user = store.getUser(job.userId);
      if (!user || typeof user.credits !== "number") return false;
      await store.updateJob(job.id, { refunded: true });
      await store.updateUser(user.id, { credits: user.credits + job.credits });
      return true;
    },

    /** Stripe Checkout page for one pack; the page comes back to /billing. */
    async checkout(user, packId, origin) {
      if (!secret) throw new BillingError(503, "Chưa cấu hình thanh toán (STRIPE_SECRET_KEY).");
      const pack = packsNow().find((p) => p.id === packId);
      if (!pack) throw new BillingError(400, "Gói credit không hợp lệ");
      const session = await stripe("POST", "/checkout/sessions", {
        mode: "payment",
        client_reference_id: user.id,
        customer_email: user.email || undefined, // phone accounts: Stripe asks for the email on its page
        success_url: `${origin}/billing?paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?canceled=1`,
        metadata: { credits: pack.credits, userId: user.id },
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: pack.cents, product_data: { name: `${pack.credits} credit Skipli Content` } } }],
      });
      return { url: session.url, id: session.id };
    },

    /** Success page: ask Stripe about the session, so credits arrive even before (or without) the webhook. */
    async confirm(user, sessionId) {
      if (!secret) throw new BillingError(503, "Chưa cấu hình thanh toán (STRIPE_SECRET_KEY).");
      if (!/^cs_[\w]{10,200}$/.test(String(sessionId))) throw new BillingError(400, "Mã thanh toán không hợp lệ");
      const session = await stripe("GET", `/checkout/sessions/${sessionId}`);
      if (session.client_reference_id !== user.id) throw new BillingError(404, "Không tìm thấy thanh toán này");
      return { paid: session.payment_status === "paid", ...(await credit(session)) };
    },

    /** POST /api/stripe/webhook with the raw body. */
    async webhook(raw, signature) {
      if (!webhookSecret || !verifySignature(raw, signature, webhookSecret)) throw new BillingError(400, "Chữ ký webhook không hợp lệ");
      const event = JSON.parse(raw);
      const obj = event.data?.object;
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") await credit(obj);
      if (event.type === "charge.dispute.created") return { received: true, dispute: await disputeOpened(obj) };
      if (event.type === "charge.dispute.closed") return { received: true, dispute: await disputeClosed(obj) };
      return { received: true };
    },

    /** What the Credit page shows. */
    account(user) {
      return {
        enabled: !!secret,
        metered: metered(user),
        credits: metered(user) ? user.credits : null,
        packs: packsNow(),
        currency,
        costs: CREDIT_COST,
        payments: (user.payments ?? []).slice(0, 20),
      };
    },
  };
}
