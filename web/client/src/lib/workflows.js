/** Ready-made multi-tool flows shown in the tools menu, the command palette and the footer. */
export const FLOWS = [
  {
    id: "learn",
    title: "Học từ đối thủ rồi viết bài",
    hint: "Quét reels đối thủ, rồi bấm Viết content từ kết quả",
    steps: ["reels", "write"],
    to: "/fb",
  },
  {
    id: "launch",
    title: "Ra mắt sản phẩm mới",
    hint: "Viết bài đăng, rồi lên kịch bản livestream bán hàng",
    steps: ["write", "livestream"],
    to: "/write",
  },
  {
    id: "video",
    title: "Từ ý tưởng thành video",
    hint: "Viết kịch bản, rồi dựng video ngắn có giọng đọc",
    steps: ["write", "video"],
    to: "/video",
  },
];

export const GUIDE_STEPS = [
  {
    n: 1,
    title: "Nghiên cứu",
    text: "Xem đối thủ đang làm gì hiệu quả: reel nào viral, đăng ngày giờ nào, chủ đề gì lặp lại, hook mở đầu ra sao.",
    time: "3 đến 10 phút",
    tools: ["reels", "threads", "fanpage"],
    tip: "Quét 2 đến 3 đối thủ cùng ngành để thấy điểm chung, đừng chỉ nhìn một kênh.",
    to: "/fb",
    cta: "Quét đối thủ",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  },
  {
    n: 2,
    title: "Sáng tạo",
    text: "Biến những gì học được thành bài viết, video, kịch bản livestream của riêng bạn. AI học cách viết, không chép câu chữ.",
    time: "1 đến 5 phút",
    tools: ["write", "clone", "video", "livestream"],
    tip: "Từ trang kết quả quét, bấm Viết content từ kết quả này để AI viết đúng theo công thức đang hiệu quả.",
    to: "/write",
    cta: "Viết content",
    icon: "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3",
  },
  {
    n: 3,
    title: "Lưu và đăng",
    text: "Giữ lại bài hay trong thư viện, sửa chỗ [GIÁ], [LINK] bằng thông tin thật, rồi dùng lại làm mẫu cho lần sau.",
    time: "Tức thì",
    tools: ["library", "schedule"],
    tip: "Lưu cả những bài đối thủ làm tốt làm mẫu, lần sau chọn mẫu đó khi viết là AI theo đúng cấu trúc.",
    to: "/library",
    cta: "Mở thư viện",
    icon: "M6 3h12v18l-6-4-6 4z",
  },
];

export const FAQ = [
  ["Sử dụng", "Vì sao quét đối thủ mất vài phút?", "Hệ thống đọc tới 100 reel mới nhất, lấy số cảm xúc, bình luận, chia sẻ của từng reel, xếp hạng rồi để AI xem kỹ những video nổi bật. Bạn có thể rời trang trong lúc chờ: kết quả tự lưu vào Lịch sử và chuông thông báo sẽ báo khi xong."],
  ["Tài khoản", "Có cần đăng nhập Facebook hay Threads không?", "Không. Công cụ chỉ đọc nội dung công khai mà ai cũng xem được, không cần và không bao giờ hỏi tài khoản mạng xã hội của bạn."],
  ["Nội dung", "AI có chép bài của đối thủ không?", "Không. AI chỉ học cách viết: kiểu hook, cấu trúc, góc tiếp cận, độ dài. Câu chữ, câu chuyện, số liệu và tên thương hiệu đều được viết mới cho sản phẩm của bạn."],
  ["Nội dung", "Chỗ [GIÁ], [LINK] trong bài là gì?", "Là những thông tin AI không biết chắc. Thay vì bịa giá, ưu đãi hay số điện thoại, AI để chỗ trống để bạn điền thông tin thật trước khi đăng."],
  ["Kết quả", "Kết quả được lưu ở đâu?", "Mọi lần chạy nằm trong Lịch sử, mở lại được bất cứ lúc nào. Bài bạn bấm Lưu nằm trong Thư viện, mục Đã lưu. Nhấn ⌘K (Ctrl+K) để tìm nhanh cả hai."],
  ["Kết quả", "Kết quả chưa ưng ý thì làm sao?", "Bấm Chạy lại để AI làm lần nữa với cùng thông tin, hoặc sửa lại phần nhập (thêm chủ đề, ưu đãi, giọng văn) cho cụ thể hơn. Với Nhân bản kênh, bạn sửa trực tiếp từng bài ngay trên bảng."],
  ["Video", "Tạo video AI mất bao lâu, có tốn phí không?", "Video chạy trên GPU miễn phí nên mất khoảng 15 đến 40 phút tuỳ độ dài. Có giọng đọc và phụ đề tiếng Việt, tải về dạng MP4."],
  ["Sử dụng", "Nên bắt đầu từ công cụ nào?", "Nếu chưa biết đăng gì: bắt đầu bằng Quét Reels hoặc Phân tích fanpage của một đối thủ bạn ngưỡng mộ, rồi viết content từ kết quả đó. Nếu đã có sản phẩm cần bán: vào thẳng Viết content hoặc Kịch bản livestream."],
];
