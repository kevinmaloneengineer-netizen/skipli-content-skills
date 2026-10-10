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
  tiktok: {
    perks: ["Miễn phí", "Không cần đăng nhập", "Số liệu thật từng video"],
    steps: [
      ["Nhập từ khoá", "Hoặc tài khoản TikTok của đối thủ."],
      ["Tìm và đọc số liệu", "Lượt xem, thích, bình luận, chia sẻ, lưu của từng video."],
      ["Rút ra công thức", "Hook, độ dài, âm thanh và ý tưởng quay cho bạn."],
    ],
    output: ["Top video kèm số liệu và xem ngay trên trang", "Hook và lý do viral của từng video", "5 ý tưởng quay cho kênh của bạn"],
  },
  maps: {
    perks: ["Không cần đăng nhập", "30 ít sao + 30 nhiều sao", "Có phân bố số sao"],
    steps: [
      ["Dán link quán", "Link Google Maps, hoặc tên quán kèm khu vực."],
      ["Đọc đánh giá", "Lấy 30 đánh giá ít sao và 30 nhiều sao nhất, đếm số sao."],
      ["Tìm điểm yếu", "Khách khen gì, chê gì, và cơ hội cho quán bạn."],
    ],
    output: ["Phân bố số sao", "Bảng điểm khen, điểm chê kèm trích dẫn", "Việc nên làm để hơn đối thủ"],
  },
  yelp: {
    perks: ["Cho quán ở Mỹ", "30 ít sao + 30 nhiều sao", "Khoảng $0,06 mỗi lần"],
    steps: [
      ["Dán link Yelp", "Trang quán trên Yelp, dạng yelp.com/biz/ten-quan."],
      ["Đọc review", "Lấy 30 review ít sao và 30 review nhiều sao nhất."],
      ["Tìm điểm yếu", "Khách khen gì, chê gì, và cơ hội cho quán bạn."],
    ],
    output: ["Điểm Yelp và số review", "Bảng điểm khen, điểm chê kèm trích dẫn", "Nút soạn trả lời cho review ít sao"],
  },
  instagram: {
    perks: ["40 bài gần nhất", "Có số liệu", "Khoảng $0,07 mỗi lần"],
    steps: [
      ["Nhập tài khoản", "Tên Instagram như @franklinbbq, hoặc link trang cá nhân."],
      ["Tính số liệu", "Tần suất đăng, ngày giờ, loại bài, caption, hashtag."],
      ["AI nhận xét", "Loại bài và chủ đề ăn khách, điều nên học và nên tránh."],
    ],
    output: ["Đăng ngày nào, giờ nào tương tác cao", "Ảnh, album hay reel hiệu quả hơn", "Top bài xem ngay trên trang"],
  },
  menu: {
    perks: ["Tối đa 12 món", "3 kiểu nội dung mỗi món", "Không bịa giá"],
    steps: [
      ["Liệt kê món", "Tên món, giá, nguyên liệu nổi bật."],
      ["Chọn nơi dùng", "Menu in, app giao đồ ăn hay mạng xã hội."],
      ["Nhận nội dung", "Mỗi món một thẻ, sao chép là dùng."],
    ],
    output: ["Dòng menu in ngắn gọn", "Mô tả cho GrabFood, ShopeeFood", "Caption mạng xã hội và gợi ý món ăn kèm"],
  },
  review: {
    perks: ["3 phương án", "An toàn khi đăng công khai"],
    steps: [
      ["Dán đánh giá", "Từ Google Maps, Facebook hay Foody."],
      ["Chọn giọng", "Chân thành, chuyên nghiệp hay gần gũi."],
      ["Đăng trả lời", "Sao chép phương án ưng ý."],
    ],
    output: ["Khách đang nói gì và cảm xúc ra sao", "3 câu trả lời khác giọng", "Việc nên làm thêm để khách quay lại"],
  },
  inbox: {
    perks: ["8 đến 12 tình huống", "Hướng tới chốt đơn"],
    steps: [
      ["Mô tả cửa hàng", "Bán gì, giá, chính sách có thật."],
      ["Chọn kênh", "Messenger, Zalo hoặc TikTok."],
      ["Lưu mẫu trả lời", "Sao chép từng tình huống khi khách nhắn."],
    ],
    output: ["Câu trả lời cho từng câu khách hay hỏi", "Tin nhắn gửi lại khi khách im lặng", "Mẹo chốt đơn qua inbox"],
  },
  hashtag: {
    perks: ["4 bộ hashtag", "Theo khu vực", "Kèm giờ đăng"],
    steps: [
      ["Nhập quán", "Món hoặc sản phẩm chính, khu vực."],
      ["Chọn nền tảng", "Facebook, TikTok, Instagram, Threads."],
      ["Dùng ngay", "Sao chép từng bộ, đăng đúng khung giờ."],
    ],
    output: ["4 bộ hashtag theo mục đích", "Khung giờ đăng cho từng nền tảng", "Cách xoay vòng hashtag"],
  },
  compare: {
    perks: ["Miễn phí", "Không cần đăng nhập", "2 đến 3 kênh"],
    steps: [
      ["Dán link fanpage", "2 hoặc 3 kênh đối thủ."],
      ["Đọc và tính số liệu", "50 reel gần nhất mỗi kênh, cùng một cách tính."],
      ["So sánh", "Biểu đồ cạnh nhau và bài học từ từng kênh."],
    ],
    output: ["Biểu đồ so sánh tần suất, tương tác, reel viral", "Ngày, giờ, độ dài video hiệu quả của từng kênh", "Điểm mạnh, điểm yếu và bài học cho bạn"],
  },
  campaign: {
    perks: ["3 bước trong 1 lần chạy", "AI xem video đối thủ", "Thêm vào lịch 1 nút"],
    steps: [
      ["Dán link đối thủ", "Và mô tả kênh của bạn."],
      ["AI học từ đối thủ", "Quét kênh, xem 3 reel nhiều tương tác nhất."],
      ["Nhận kế hoạch tuần", "Mỗi ngày một bài viết sẵn, kèm giờ đăng."],
    ],
    output: ["3 reel đối thủ AI đã học", "Kế hoạch 7 hoặc 14 ngày, bài viết sẵn", "Thêm cả tuần vào lịch đăng"],
  },
};
