export const STATUS = { queued: "Đang chờ", running: "Đang chạy", done: "Hoàn tất", failed: "Lỗi", canceled: "Đã huỷ" };

export const ACTIVE = new Set(["queued", "running"]);

/**
 * Skills shown on the home screen. `type` links a skill to its jobs;
 * `tone` picks the colour set in styles.css ([data-tone]).
 */
export const SKILLS = [
  {
    id: "reels",
    type: "fb-reels",
    path: "/fb",
    tone: "coral",
    title: "Quét Reels đối thủ",
    short: "Quét Reels",
    pitch: "Chỉ cần dán link kênh Facebook. Hệ thống quét 100 reel mới nhất, xếp hạng theo tương tác, rồi AI xem video và chọn ra những cái đáng học.",
    eta: "3 đến 10 phút",
    etaLong: "Quét 100 reel thường mất 5 đến 10 phút, một reel lẻ khoảng 1 phút.",
  },
  {
    id: "threads",
    type: "threads",
    path: "/threads",
    tone: "ink",
    title: "Content viral Threads",
    short: "Threads",
    pitch: "Tìm bài Threads nhiều tương tác nhất theo từ khoá hoặc tài khoản, hiểu vì sao chúng viral.",
    eta: "1 đến 3 phút",
    etaLong: "Thường mất 1 đến 3 phút.",
  },
  {
    id: "write",
    type: "write",
    path: "/write",
    tone: "green",
    title: "Viết content AI",
    short: "Viết content",
    pitch: "Bài Facebook, Threads, kịch bản video, quảng cáo. Viết theo mẫu của bạn hoặc lấy cảm hứng từ kết quả quét.",
    eta: "< 1 phút",
    etaLong: "Thường dưới 1 phút.",
  },
  {
    id: "clone",
    type: "clone",
    path: "/clone",
    tone: "violet",
    title: "Nhân bản kênh đối thủ",
    short: "Nhân bản kênh",
    pitch: "Dán link kênh đối thủ, AI đọc những bài ăn tương tác nhất rồi viết hàng loạt bài mới cho kênh của bạn, chia sẵn theo nhóm nội dung.",
    eta: "2 đến 5 phút",
    etaLong: "Thường mất 2 đến 5 phút: đọc kênh đối thủ rồi viết từng bài.",
  },
  {
    id: "video",
    type: "video",
    path: "/video",
    tone: "sky",
    title: "Tạo video AI",
    short: "Video AI",
    pitch: "Từ một chủ đề, một ảnh storyboard hay một đoạn lời kể, AI dựng thành video ngắn có giọng đọc tiếng Việt và phụ đề. Chạy trên GPU miễn phí.",
    eta: "15 đến 40 phút",
    etaLong: "Trên GPU miễn phí, mỗi cảnh mất vài phút: thường 15 đến 40 phút cho cả video.",
  },
  {
    id: "library",
    path: "/library",
    tone: "mustard",
    title: "Thư viện mẫu content",
    short: "Thư viện",
    pitch: "Cấu trúc bài viết (PAS, AIDA, kể chuyện…) để AI viết theo, và những bài bạn đã lưu.",
    eta: "Tức thì",
  },

  // ---- Đang phát triển: card hiện trên trang chủ, bấm vào là trang "Đang phát triển" ----
  {
    id: "tiktok",
    status: "soon",
    path: "/skills/tiktok",
    tone: "rose",
    title: "Content viral TikTok",
    short: "TikTok",
    pitch: "Tìm video TikTok đang lên theo từ khoá hoặc kênh, xem vì sao chúng giữ chân người xem.",
    plan: ["Quét video theo từ khoá, hashtag hoặc kênh", "Xếp hạng theo lượt xem, thích, bình luận, chia sẻ", "AI tóm tắt hook, nhịp dựng và lời thoại của từng video"],
  },
  {
    id: "maps",
    type: "maps",
    path: "/maps",
    tone: "brick",
    title: "Phân tích review Google Maps",
    short: "Review đối thủ",
    pitch: "Đọc 80 đánh giá Google Maps gần nhất của quán đối thủ: khách khen gì, chê gì, và quán bạn nên nhấn vào điểm nào.",
    eta: "1 đến 2 phút",
    etaLong: "Mở Google Maps và đọc đánh giá mất khoảng 30 giây, AI phân tích thêm chưa tới 1 phút.",
  },  {
    id: "fanpage",
    type: "fanpage",
    path: "/fanpage",
    tone: "blue",
    title: "Phân tích fanpage đối thủ",
    short: "Fanpage",
    pitch: "Đối thủ đăng bao nhiêu, ngày giờ nào ăn tương tác, video dài bao lâu thì hiệu quả, chủ đề gì lặp lại. Có số liệu đi kèm.",
    eta: "2 đến 4 phút",
    etaLong: "Thường mất 2 đến 4 phút để đọc 100 reel và tính số liệu.",
  },
  {
    id: "image",
    type: "image",
    path: "/image",
    tone: "plum",
    title: "Tạo ảnh quảng cáo AI",
    short: "Ảnh AI",
    pitch: "Ảnh sản phẩm, banner, ảnh story kèm tiêu đề và nút kêu gọi tiếng Việt sửa được, đúng khung từng nền tảng.",
    eta: "1 đến 3 phút",
    etaLong: "AI lên ý tưởng rồi GPU vẽ ảnh: thường 1 đến 3 phút, lần đầu mỗi phiên lâu hơn vì phải tải model.",
  },
  {
    id: "schedule",
    type: "plan",
    path: "/schedule",
    tone: "teal",
    title: "Lên lịch đăng bài",
    short: "Lịch đăng",
    pitch: "Xếp bài vào lịch tuần, kéo thả đổi ngày, đánh dấu đã đăng. AI lên sẵn kế hoạch 7 ngày kèm bài viết và giờ đăng.",
    eta: "khoảng 1 phút",
    etaLong: "AI viết kế hoạch thường mất khoảng 1 phút.",
  },
  {
    id: "livestream",
    type: "livestream",
    path: "/livestream",
    tone: "olive",
    title: "Kịch bản livestream bán hàng",
    short: "Livestream",
    pitch: "Kịch bản theo từng phút: mở màn, giới thiệu sản phẩm, chốt đơn, mini game, trả lời câu hỏi thường gặp.",
    eta: "khoảng 1 phút",
    etaLong: "Thường mất khoảng 1 phút.",
  },
  {
    id: "menu",
    type: "menu",
    path: "/menu",
    tone: "mint",
    title: "Viết menu và mô tả món",
    short: "Menu",
    pitch: "Từ danh sách món, AI viết dòng menu in, mô tả cho GrabFood, ShopeeFood và caption đăng mạng xã hội cho từng món.",
    eta: "dưới 1 phút",
    etaLong: "Thường dưới 1 phút.",
  },  {
    id: "review",
    type: "review",
    path: "/review",
    tone: "amber",
    title: "Trả lời review khách",
    short: "Trả lời review",
    pitch: "Dán đánh giá của khách, AI viết 3 câu trả lời khéo léo. Review chê có thêm cách xin lỗi và mời khách quay lại.",
    eta: "dưới 1 phút",
    etaLong: "Thường dưới 1 phút.",
  },  {
    id: "inbox",
    type: "inbox",
    path: "/inbox",
    tone: "indigo",
    title: "Kịch bản inbox chốt đơn",
    short: "Inbox",
    pitch: "Câu trả lời mẫu cho những gì khách hay nhắn: hỏi giá, ship, còn hàng, đặt bàn, chê đắt. Câu nào cũng dẫn tới chốt đơn.",
    eta: "dưới 1 phút",
    etaLong: "Thường dưới 1 phút.",
  },];

/** Home-page grouping by skill type: each type is one pinned, horizontally scrolling scene. */
export const CATEGORIES = [
  {
    id: "research",
    tag: "Phân tích thị trường",
    title: "Nghiên cứu đối thủ",
    word: "NGHIÊN CỨU",
    dark: true,
    desc: "Biết đối thủ đang làm gì hiệu quả, bài nào viral và vì sao viral, trước khi bạn viết chữ nào.",
    skills: ["reels", "threads", "tiktok", "fanpage", "maps"],
    deco: ["search", "chart", "heart", "eye", "play", "trend", "comment", "search"],
  },
  {
    id: "create",
    tag: "Tạo nội dung bằng AI",
    title: "Sáng tạo nội dung",
    word: "SÁNG TẠO",
    dark: true,
    desc: "Biến những gì học được thành bài viết, hình ảnh và kịch bản của riêng bạn, không chép của ai.",
    skills: ["write", "clone", "video", "image", "livestream", "menu"],
    deco: ["pen", "spark", "image", "quote", "lines", "wand", "spark", "pen"],
  },
  {
    id: "organize",
    tag: "Tổ chức & vận hành",
    title: "Đăng bài & chăm khách",
    word: "CHĂM KHÁCH",
    desc: "Giữ lại mẫu hay, xếp lịch đăng đúng giờ, trả lời review và tin nhắn để khách quay lại.",
    skills: ["library", "schedule", "review", "inbox"],
    deco: ["calendar", "clock", "bookmark", "check", "folder", "bell", "check", "clock"],
  },
];

export const skillById = (id) => SKILLS.find((s) => s.id === id);

export const skillByType = (type) => SKILLS.find((s) => s.type === type);

export const PLATFORMS = { facebook: "Facebook", threads: "Threads", tiktok: "Video ngắn", ads: "Quảng cáo" };

export const TONES = ["Chuyên gia, đáng tin", "Hài hước, bắt trend", "Truyền cảm hứng", "Ngắn gọn, đi thẳng vào vấn đề", "Gen Z, trẻ trung"];

export const CLONE_PLATFORMS = { facebook: "Facebook", threads: "Threads", tiktok: "Video ngắn" };
