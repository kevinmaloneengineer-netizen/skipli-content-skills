// "Khảo sát tại bàn": a shop prints a QR code; guests answer three quick questions on their phone (no
// login). The owner sees the averages and the comments, and gets an email when an answer is poor, so a
// complaint reaches them before it becomes a 1-star review. No IP address or device id is stored.

const clip = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export class SurveyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** The owner's form: the shop name shown to guests, an optional line above the questions and after sending. */
export function surveyFields(raw = {}) {
  const name = clip(raw.name, 80);
  if (!name) throw new SurveyError("Nhập tên quán");
  return {
    name,
    intro: clip(raw.intro, 160),
    thanks: clip(raw.thanks, 160),
    alert: raw.alert !== false, // email the owner when an answer is poor
    praise: raw.praise !== false, // and when a guest praises the place
    open: raw.open !== false, // closed: the QR page says so and takes no answers
    lang: raw.lang === "en" ? "en" : "vi", // the guests' page: Vietnamese, or English for a US restaurant
  };
}

export const BACK = { yes: "Chắc chắn", maybe: "Có thể", no: "Không" };

/** A guest's answer, checked: two 1–5 ratings, would they come back, an optional comment and contact. */
export function answerFields(raw = {}) {
  const food = Number(raw.food);
  const service = Number(raw.service);
  if (![food, service].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) throw new SurveyError("Chọn số sao cho món ăn và phục vụ");
  if (!BACK[raw.back]) throw new SurveyError("Chọn bạn có quay lại không");
  return { food, service, back: raw.back, comment: clip(raw.comment, 500), contact: clip(raw.contact, 100) };
}

/** Praise worth passing on: 4 stars or more for both, and the guest will be back. */
export const isHigh = (a) => a.food >= 4 && a.service >= 4 && a.back === "yes";

/** Poor enough that the owner should hear about it now. */
export const isLow = (a) => a.food <= 2 || a.service <= 2 || a.back === "no";

/** Averages over the answers given (newest first): count, food, service, share who would come back, poor ones. */
export function surveyStats(answers) {
  const n = answers.length;
  const avg = (k) => (n ? Math.round((answers.reduce((s, a) => s + a[k], 0) / n) * 10) / 10 : null);
  return {
    count: n,
    food: avg("food"),
    service: avg("service"),
    backYes: n ? Math.round((answers.filter((a) => a.back === "yes").length / n) * 100) : null,
    low: answers.filter(isLow).length,
    lastAt: answers[0]?.createdAt ?? null,
  };
}
