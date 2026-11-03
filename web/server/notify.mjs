import { emailHtml, pill } from "./emailLayout.mjs";

// Emails the app sends on its own (not codes): a customer whose credits run low gets one reminder with a
// link to top up. Never more than one every 3 days per account, and only when mail is set up.

export const LOW_CREDITS = 5;
const EVERY_MS = 3 * 86_400_000;

/** @returns {(user: object, left: number) => Promise<boolean>} sends the reminder; true when a mail went out */
export function createLowCreditMail({ store, mailer, publicUrl = process.env.PUBLIC_URL ?? "", log = console }) {
  return async function lowCredits(user, left) {
    if (!mailer?.enabled || !user?.email || user.role === "admin") return false;
    if (Date.now() - Date.parse(user.lowCreditMailAt ?? 0) < EVERY_MS) return false;
    // Noted first (the store updates at once), so two runs ending together send one mail.
    await store.updateUser(user.id, { lowCreditMailAt: new Date().toISOString() });
    const link = publicUrl ? `${publicUrl.replace(/\/+$/, "")}/billing` : "";
    const lead = `Tài khoản Skipli Content của bạn còn ${left} credit.`;
    const tail = "Lượt chạy lỗi hoặc bị huỷ luôn được hoàn credit. Bạn nhận email này vì số credit vừa xuống dưới " + LOW_CREDITS + "; mỗi 3 ngày tối đa một lần.";
    try {
      await mailer.send({
        to: user.email,
        subject: `Còn ${left} credit trên Skipli Content`,
        text: `${lead} Nạp thêm để không bị gián đoạn khi đang làm content${link ? `: ${link}` : " ở trang Credit"}.\n\n${tail}`,
        html: emailHtml({
          preheader: lead,
          kicker: pill(`Còn ${left} credit`, { bg: "#f6e6bf", fg: "#8a5a00" }),
          title: "Sắp hết credit",
          intro: `${lead} Nạp thêm để không bị gián đoạn khi đang làm content${link ? "." : ": vào trang Credit trên web."}`,
          button: link ? { href: link, label: "Nạp credit" } : undefined,
          footer: tail,
        }),
      });
      return true;
    } catch (e) {
      log.error?.(`low credit mail to ${user.email} failed: ${e.message}`);
      return false;
    }
  };
}
