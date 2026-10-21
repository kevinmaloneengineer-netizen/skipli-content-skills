// The slideshow templates (server/collage.mjs plans them), shared by the video form and the "Đổi mẫu" panel.
import { getLang } from "./i18n.js";

// Slideshow templates: [id, name, what it shows]. The featured ones come first.
export const TEMPLATES = [
  ["map", "Chỉ đường", "Bản đồ thật (OpenStreetMap), ghim rơi xuống đúng chỗ quán, thẻ tên và địa chỉ"],
  ["news", "Bản tin nóng", "Khung tin tức truyền hình: nhãn Tin nóng, tiêu đề, dòng chữ chạy bên dưới"],
  ["top3", "Top 3 món phải thử", "Đếm ngược #3, #2, #1: mỗi món một ảnh lớn kèm tên và giá"],
  ["coupon", "Phiếu ưu đãi", "Phiếu xé có mã vạch ghi ưu đãi, rồi phiếu đặt trên ảnh món"],
  ["collage", "Ghép ảnh kiểu Canva", "Ô tìm kiếm, trang giới thiệu, khung ghép ảnh, ảnh nghiêng"],
  ["promo", "Khuyến mãi", "Câu ưu đãi chữ to, ruy băng ưu đãi trên ảnh món"],
  ["menu", "Menu và giá", "Thẻ món có ảnh, tên, giá như menu điện tử"],
  ["polaroid", "Tường ảnh Polaroid", "Ảnh polaroid rơi xuống xếp nghiêng trên nền màu"],
  ["bold", "Chữ to kiểu tạp chí", "3 chữ thật to xen kẽ ảnh toàn khung"],
  ["film", "Cuộn phim", "Ảnh chạy dọc trên dải phim, chữ Đang chiếu và tên quán"],
  ["magazine", "Bìa tạp chí", "Ảnh làm bìa, tên quán là tên tạp chí, các dòng giới thiệu món"],
  ["grid", "Lưới 9 ô", "Ảnh hiện dần từng ô như trang cá nhân, ô giữa là logo"],
  ["story", "Story Instagram", "Thanh tiến trình, tên quán ở góc, nhãn dán chữ trên từng ảnh"],
  ["receipt", "Hoá đơn", "Tờ hoá đơn in ra danh sách món và giá, rồi tới ảnh món"],
  ["neon", "Đèn neon", "Nền tối, tên quán và tên món phát sáng như bảng đèn"],
  ["postcard", "Bưu thiếp", "Ảnh in trên bưu thiếp có tem, dấu bưu điện và lời giới thiệu"],
  ["spotlight", "Món nổi bật", "Từng món trong khung tròn trên nền màu, tên món và giá"],
  ["marquee", "Chữ chạy", "Hai dải chữ chạy ngược chiều trên ảnh toàn khung"],
  ["chalk", "Bảng phấn", "Món hôm nay viết phấn trên bảng đen, ảnh món dán băng keo lên bảng"],
  ["single", "Từng ảnh", "Mỗi cảnh một ảnh, chuyển cảnh mờ dần"],
];
// Shown first with a "Nổi bật" tag, one per goal: be found (the real map), stop the scroll (the news frame),
// show the dishes (Top 3 countdown), bring people in (the tear-off coupon).
export const FEATURED = new Set(["map", "news", "top3", "coupon"]);
// Templates that take the dish list (names, prices only when typed).
export const DISH_TEMPLATES = { top3: "3 món phải thử (mỗi dòng một món, giá tuỳ chọn)", spotlight: "3 món nổi bật (mỗi dòng một món, giá tuỳ chọn)", menu: "Món và giá (tối đa 4 món, mỗi dòng một món)", receipt: "Món trên hoá đơn (tối đa 4 món, mỗi dòng một món, giá tuỳ chọn)", chalk: "Món trên bảng (tối đa 4 món, mỗi dòng một món, giá tuỳ chọn)" };
// Templates built around a deal: they need the offer line.
export const OFFER_TEMPLATES = new Set(["promo", "coupon"]);
// Sample clip of a template (client/public/samples, rendered from the same code with stock photos).
export const SAMPLE_VERSION = 4; // bump after re-rendering the samples so browsers fetch the new files
export const sampleOf = (id) => `/samples/${id === "single" ? "single" : `${id}-${getLang()}`}`;
