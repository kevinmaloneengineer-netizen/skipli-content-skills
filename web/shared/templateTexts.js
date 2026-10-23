// Words of the slideshow templates that the user can change, per template: [key, field label, the template's
// own words]. Empty = the template's own words (in the video's language). Shared by the video form, the
// "Đổi mẫu" panel and the server (which keeps only these keys, see cleanTexts).
// "words" is a comma-separated list (the big words of "bold", extra running words of "marquee").

export const TEMPLATE_TEXTS = {
  collage: [["seeMore", "Nút ở trang giới thiệu", "Xem thêm >"]],
  top3: [["top3", "Tiêu đề", "Top 3 món phải thử"]],
  menu: [["menu", "Tiêu đề", "Thực đơn"]],
  promo: [["deal", "Nhãn dán tròn", "ƯU ĐÃI"], ["onlyAt", "Chữ trước tên quán", "Chỉ có tại"]],
  bold: [["words", "3 chữ thật to (cách nhau dấu phẩy)", "Nóng hổi, Đậm đà, Ghé ngay"]],
  film: [["showing", "Nhãn trên cuộn phim", "Đang chiếu"]],
  magazine: [["issue", "Dòng dưới tên tạp chí", "Số đặc biệt"]],
  story: [["now", "Chữ cạnh tên quán", "vừa xong"]],
  receipt: [["receipt", "Tiêu đề hoá đơn", "Hoá đơn"], ["thanks", "Lời cảm ơn cuối hoá đơn", "Cảm ơn quý khách!"]],
  postcard: [["from", "Chữ trước tên quán", "Gửi từ"]],
  spotlight: [["spotlight", "Tiêu đề", "Món nổi bật"]],
  marquee: [["words", "Chữ chạy thêm (cách nhau dấu phẩy)", "Nóng hổi, Đậm đà, Ghé ngay"]],
  news: [["breaking", "Nhãn tin", "Tin nóng"], ["live", "Nhãn góc trên", "Trực tiếp"], ["mustTry", "Dòng dưới tên món", "Món nên thử"]],
  chalk: [["today", "Tiêu đề bảng", "Hôm nay có"]],
  map: [["findUs", "Nhãn trên bản đồ", "Quán ở đây"]],
  coupon: [["coupon", "Nhãn trên phiếu", "Phiếu ưu đãi"], ["onlyAt", "Chữ trước tên quán", "Chỉ có tại"]],
  stamp: [["sub", "Dòng dưới tên quán", "Mỗi lần ghé, đóng một dấu"], ["reward", "Quà khi đủ dấu (để trống thì lấy câu ưu đãi)", "[QUÀ TẶNG]"]],
  week: [["title", "Tiêu đề", "Tuần này"]],
  score: [["watch", "Tiêu đề", "Xem bóng đá tại quán"], ["home", "Tên đội nhà", "ĐỘI NHÀ"], ["away", "Tên đội khách", "ĐỐI THỦ"], ["when", "Giờ bóng lăn", "[GIỜ BÓNG LĂN]"]],
};

const MAX = 40;

/** The user's words for `layout`: only that template's keys, trimmed and capped; "words" becomes a list. */
export function cleanTexts(layout, raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key] of TEMPLATE_TEXTS[layout] ?? []) {
    const value = String(raw[key] ?? "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    out[key] = key === "words" ? value.split(",").map((w) => w.trim().slice(0, 18)).filter(Boolean).slice(0, 5) : value.slice(0, MAX);
  }
  return out;
}
