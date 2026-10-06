/**
 * Copy for the skill pages: chips under the title, the 3 "how it works" steps,
 * and what the result contains (side panel). Keyed by skill id (lib/constants.js).
 */
export const GUIDE = {
  reels: {
    perks: ["Miễn phí", "Không cần đăng nhập", "100 reel mỗi lần"],
    steps: [
      ["Dán link kênh", "Trang, trang cá nhân hoặc một reel bất kỳ."],
      ["Quét và xếp hạng", "Đọc 100 reel mới nhất, chấm điểm theo cảm xúc, bình luận, chia sẻ."],
      ["AI xem video", "Chọn ra những reel đáng học và giải thích vì sao."],
    ],
    output: ["Bảng xếp hạng reel theo tương tác", "Hook, nội dung chính của từng video", "Lý do vì sao reel đó hiệu quả"],
  },
  threads: {
    perks: ["Miễn phí", "Không cần đăng nhập", "Theo từ khoá hoặc tài khoản"],
    steps: [
      ["Nhập từ khoá", "Hoặc tài khoản đối thủ trên Threads."],
      ["Quét bài nổi bật", "Lấy bài hàng đầu, xếp hạng theo thích, trả lời, đăng lại."],
      ["Rút ra công thức", "Pattern chung và ý tưởng bài viết cho bạn."],
    ],
    output: ["Top bài viral kèm số liệu", "Vì sao từng bài được chia sẻ", "Ý tưởng góc viết mới cho bạn"],
  },
  write: {
    perks: ["Dưới 1 phút", "Nhiều phương án", "Theo mẫu của bạn"],
    steps: [
      ["Nhập chủ đề", "Sản phẩm, khách hàng, ưu đãi có thật."],
      ["Chọn cách viết", "Nền tảng, giọng văn, mẫu cấu trúc hoặc bài tham khảo."],
      ["Nhận bài viết", "Mỗi phương án một góc khác nhau, sao chép là đăng."],
    ],
    output: ["1 đến 5 phương án sẵn đăng", "Hook mạnh ở dòng đầu", "Chỗ trống [GIÁ], [LINK] để bạn điền"],
  },
  clone: {
    perks: ["Không cần đăng nhập", "6 đến 12 bài mỗi lần", "Chia sẵn 4 nhóm"],
    steps: [
      ["Dán link đối thủ", "Hoặc dán thẳng các bài viết của họ."],
      ["AI học công thức", "Chọn bài nhiều tương tác nhất, phân tích hook và cấu trúc."],
      ["Viết bài cho bạn", "Nội dung mới hoàn toàn, chia theo nhóm, sửa và lưu ngay."],
    ],
    output: ["Bảng bài viết chia theo nhóm nội dung", "Mỗi bài ghi rõ học từ bài gốc nào", "Sửa trực tiếp, xem trước, lưu hàng loạt"],
  },
  video: {
    perks: ["GPU miễn phí", "Giọng đọc tiếng Việt", "Có phụ đề"],
    steps: [
      ["Chọn cách làm", "Chủ đề, ảnh storyboard hoặc đoạn lời kể."],
      ["AI chia cảnh", "Viết lời thoại và mô tả hình cho từng cảnh."],
      ["Dựng video", "Tạo clip, lồng tiếng, chèn phụ đề, ghép thành MP4."],
    ],
    output: ["File MP4 dọc, ngang hoặc vuông", "Giọng đọc và phụ đề tiếng Việt", "Kịch bản từng cảnh để chỉnh lại"],
  },
  fanpage: {
    perks: ["Miễn phí", "Không cần đăng nhập", "Có số liệu"],
    steps: [
      ["Dán link fanpage", "Trang công khai có đăng reels."],
      ["Tính số liệu", "Tần suất đăng, ngày giờ, độ dài video, caption, hashtag."],
      ["AI nhận xét", "Chủ đề ăn khách, điều nên học và nên tránh."],
    ],
    output: ["Đăng ngày nào, giờ nào tương tác cao", "Video dài bao lâu thì hiệu quả", "Top reel và chủ đề lặp lại"],
  },
  livestream: {
    perks: ["Khoảng 1 phút", "30, 60 hoặc 90 phút", "Facebook và TikTok"],
    steps: [
      ["Nhập sản phẩm", "Tên, giá, điểm nổi bật, ưu đãi có thật."],
      ["Chọn thời lượng", "AI chia buổi live thành từng mốc phút."],
      ["Nhận kịch bản", "Lời thoại, hành động, câu chốt đơn, trả lời bình luận."],
    ],
    output: ["Kịch bản theo từng mốc thời gian", "Câu chốt đơn và xử lý từ chối", "Trả lời nhanh bình luận hay gặp"],
  },
  image: {
    perks: ["GPU miễn phí", "Chữ tiếng Việt sửa được", "Đúng khung nền tảng"],
    steps: [
      ["Nhập sản phẩm", "Tên, điểm nổi bật, có thể kèm ảnh sản phẩm thật."],
      ["AI lên ý tưởng", "Mỗi ảnh một góc khác nhau, kèm tiêu đề, dòng phụ, nút kêu gọi."],
      ["Vẽ và chỉnh chữ", "GPU vẽ ảnh, bạn sửa chữ ngay trên ảnh rồi tải PNG."],
    ],
    output: ["1 đến 4 ảnh đúng khung bạn chọn", "Tiêu đề, dòng phụ, nút kêu gọi sửa trực tiếp", "Caption đăng kèm từng ảnh"],
  },
  schedule: {
    perks: ["Kéo thả đổi ngày", "AI lên kế hoạch tuần", "Gợi ý giờ đăng"],
    steps: [
      ["Thêm bài", "Từ thư viện, từ kết quả AI, hoặc viết mới."],
      ["Xếp lịch", "Chọn ngày giờ, kéo thả sang ngày khác, xem theo tuần hoặc tháng."],
      ["Đăng và đánh dấu", "Tới giờ sao chép bài đi đăng, bấm đã đăng để theo dõi."],
    ],
    output: ["Lịch tuần, tháng của mọi bài sắp đăng", "Kế hoạch 7 hoặc 14 ngày viết sẵn bài", "Theo dõi bài đã đăng, chưa đăng"],
  },
};
