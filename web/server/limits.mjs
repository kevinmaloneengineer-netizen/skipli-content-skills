// Usage limits so one visitor cannot spend the shared free AI quota. All counters are per server
// process (the app runs as one replica); the daily job count is read from the stored jobs so it
// survives restarts. Every limit can be changed or turned off (0) in deploy/.env.

const num = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== "" && process.env[name] !== undefined ? n : fallback;
};
const LIMITS = {
  jobsPerDay: num("DAILY_JOB_LIMIT", 80), // whole app, Vietnam calendar day
  jobsPerIpHour: num("JOB_LIMIT_PER_IP_HOUR", 20),
  chatPerIpMinute: num("CHAT_LIMIT_PER_IP_MINUTE", 8),
  chatPerIpDay: num("CHAT_LIMIT_PER_IP_DAY", 200),
};

const vnDay = (iso) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

export function createLimits({ store }) {
  const hits = new Map(); // "kind|ip" → timestamps

  function take(key, max, windowMs) {
    if (!max) return true;
    const now = Date.now();
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
  }

  const ipOf = (req) => req.ip ?? req.socket?.remoteAddress ?? "?";
  const tooMany = (res, message) => res.status(429).json({ error: message });

  return {
    LIMITS,
    /** Express middleware for creating a job (new run or retry). */
    jobs(req, res, next) {
      if (LIMITS.jobsPerDay) {
        const today = vnDay(new Date().toISOString());
        const count = store.listJobs().filter((j) => j.type !== "watch" && vnDay(j.createdAt) === today).length;
        if (count >= LIMITS.jobsPerDay) return tooMany(res, `Hôm nay web đã chạy đủ ${LIMITS.jobsPerDay} lượt (giới hạn để không hết hạn mức AI miễn phí). Mai thử lại nhé.`);
      }
      if (!take(`job|${ipOf(req)}`, LIMITS.jobsPerIpHour, 3600_000)) return tooMany(res, `Bạn đã chạy ${LIMITS.jobsPerIpHour} lượt trong 1 giờ qua. Nghỉ một chút rồi thử lại nhé.`);
      next();
    },
    /** Express middleware for the assistant. */
    chat(req, res, next) {
      const ip = ipOf(req);
      if (!take(`chatmin|${ip}`, LIMITS.chatPerIpMinute, 60_000)) return tooMany(res, "Bạn nhắn hơi nhanh, đợi khoảng 1 phút rồi hỏi tiếp nhé.");
      if (!take(`chatday|${ip}`, LIMITS.chatPerIpDay, 86_400_000)) return tooMany(res, "Hôm nay bạn đã hỏi trợ lý rất nhiều, mai mình trò chuyện tiếp nhé.");
      next();
    },
  };
}
