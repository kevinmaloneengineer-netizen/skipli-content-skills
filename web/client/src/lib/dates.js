// Local-time date helpers for the posting calendar (weeks start on Monday, Vietnamese labels).
export const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const WEEKDAY_LONG = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fromYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
/** ISO instant for a local day + "HH:MM". */
export const at = (day, time) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
};
export const sameDay = (a, b) => ymd(a) === ymd(b);
export const dayLabel = (d) => `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
/** Next Monday (or today if it is Monday): default start of an AI plan. */
export const nextMonday = (from = new Date()) => (from.getDay() === 1 ? from : addDays(startOfWeek(from), 7));
/** Times Vietnamese audiences are usually online; shown as quick picks. */
export const GOOD_TIMES = ["07:30", "11:30", "12:30", "19:30", "20:30", "21:30"];
