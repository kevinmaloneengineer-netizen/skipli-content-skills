// Forms of the text-only skills, all on TextSkillPage: the fields the request needs and the page's notes.
export const TEXT_SKILLS = {
  "post-score": {
    type: "post-score",
    label: "Chấm điểm bài",
    eta: "dưới 1 phút",
    fields: [
      { name: "post", kind: "area", label: "Bài viết sắp đăng", placeholder: "Dán bài viết vào đây…", required: true },
      { name: "business", label: "Quán (tuỳ chọn)", placeholder: "Phở Cali, Quận 1" },
      { name: "platform", label: "Đăng trên (tuỳ chọn)", placeholder: "Facebook, Instagram, TikTok, Threads" },
    ],
    notes: ["Điểm từng phần: câu mở đầu, nội dung, lời kêu gọi, độ dài, hashtag.", "Có danh sách sửa nhanh và bản đã sửa, giữ nguyên giá và ưu đãi của bạn."],
  },
  "dish-riddle": {
    type: "dish-riddle",
    label: "Tạo bài đố",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Phở Cali, Quận 1", required: true },
      { name: "dish", label: "Món cần đố", placeholder: "Phở bò tái", required: true },
      { name: "seen", label: "Trong ảnh chỉ thấy (tuỳ chọn)", hint: "Phần món mà ảnh cho thấy, để câu đố dựa vào đó. AI cũng tự xem ảnh bạn tải lên.", placeholder: "Tô nước màu nâu, rau thơm xanh, miếng bò đỏ hồng" },
    ],
    photo: true,
    notes: ["Tải ảnh món lên để AI xem và mô tả phần nhìn thấy, rồi viết câu đố dựa vào đó.", "Câu đố, 3 đáp án để khách chọn, đáp án đúng và 2 câu trả lời gợi ý cho admin.", "Khách bình luận đoán là kéo tương tác, nên đừng đăng đáp án ngay."],
  },
  "story-behind": {
    type: "story-behind",
    label: "Viết câu chuyện",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Phở Cali, Quận 1", required: true },
      {
        name: "answers",
        kind: "area",
        label: "Chủ quán trả lời",
        hint: "Học công thức ở đâu? Ai nấu món này đầu tiên? Kỷ niệm nào về món? Điều gì làm món khác biệt?",
        placeholder: "Công thức học từ bà ngoại ở Nam Định. Bà nấu nước dùng suốt đêm mỗi sáng. Điều khác biệt là thêm quế và hồi vào nồi từ đầu…",
        required: true,
      },
    ],
    notes: ["Chỉ dùng những gì chủ quán kể làm sự thật, không thêm năm tháng hay giải thưởng.", "Có bài đăng, lời kể 25 giây cho video, và một dòng caption."],
  },
  "gbp-post": {
    type: "gbp-post",
    label: "Viết bài Google Business",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Pho Cali, Milwaukee", required: true },
      { name: "promote", kind: "area", label: "Muốn giới thiệu điều gì", hint: "Món mới, ưu đãi, sự kiện, hoặc chính quán. Viết tiếng Anh thì bài viết tiếng Anh.", placeholder: "New spicy beef pho this week, free iced tea with every bowl", required: true },
      {
        name: "button",
        kind: "select",
        label: "Nút bấm trên bài",
        options: [["order", "Đặt món online (Order online)"], ["book", "Đặt bàn (Book)"], ["call", "Gọi ngay (Call now)"], ["offer", "Nhận ưu đãi (Offer)"], ["learn", "Xem thêm (Learn more)"]],
      },
      { name: "details", kind: "area", label: "Thông tin thật của quán (tuỳ chọn)", hint: "Giờ mở cửa, giá, điều kiện ưu đãi, chỗ đậu xe. AI chỉ dùng những gì bạn ghi, không tự bịa.", placeholder: "Open 11am to 9pm daily. Free parking behind the shop." },
    ],
    notes: ["3 bài theo 3 góc khác nhau, mỗi bài 60 đến 120 chữ, đúng giới hạn của Google.", "Kèm nút bấm, ảnh nên dùng và 5 câu hỏi đáp cho mục Hỏi đáp trên Google.", "Đăng: vào Google Business Profile của quán, Thêm cập nhật, dán bài và gắn ảnh."],
  },
  "zalo-message": {
    type: "zalo-message",
    label: "Viết tin Zalo",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Phở Cali, Quận 1", required: true },
      {
        name: "goal",
        kind: "select",
        label: "Gửi để làm gì",
        options: [["back", "Mời khách quen lâu chưa ghé quay lại"], ["offer", "Báo ưu đãi đang có"], ["new", "Giới thiệu món mới"], ["birthday", "Chúc mừng sinh nhật khách"], ["event", "Ngày lễ hoặc sự kiện của quán"]],
      },
      { name: "details", kind: "area", label: "Ưu đãi, món hoặc ngày (thông tin thật)", hint: "Bắt buộc khi báo ưu đãi, món mới hoặc sự kiện. AI chỉ dùng những gì bạn ghi, thiếu gì sẽ để chỗ trống như [NGÀY].", placeholder: "Tặng trà đá cho mỗi tô phở, từ 1/11 đến 7/11, ăn tại quán" },
      { name: "button", kind: "select", label: "Nút dưới tin", options: [["menu", "Xem menu"], ["book", "Đặt bàn"], ["call", "Gọi ngay"], ["offer", "Nhận ưu đãi"], ["map", "Chỉ đường"]] },
      { name: "contact", label: "Hotline hoặc link (tuỳ chọn)", placeholder: "0909 123 456" },
    ],
    notes: ["3 tin theo 3 góc khác nhau, mỗi tin có tiêu đề, nội dung ngắn và nút bấm.", "Tin mở đầu bằng {ten_khach}: khi gửi từ Zalo OA, chèn tên khách vào chỗ này.", "Kèm gợi ý giờ gửi và số tin mỗi tuần để khách không thấy phiền."],
  },
  "promo-plan": {
    type: "promo-plan",
    label: "Gợi ý khuyến mãi",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Phở Cali, Quận 1", required: true },
      { name: "goal", kind: "select", label: "Mục tiêu", options: [["slow", "Kéo khách vào giờ vắng"], ["bill", "Tăng giá trị mỗi đơn"], ["launch", "Đẩy món mới hoặc món ít người gọi"], ["return", "Kéo khách quen quay lại"]] },
      {
        name: "dishes",
        kind: "area",
        label: "Món, giá bán và giá vốn",
        hint: "Mỗi dòng một món: Tên món - giá bán - giá vốn. Có giá vốn thì hệ thống tính được tiền lãi của từng khuyến mãi.",
        placeholder: "Phở bò - 65.000 - 28.000\nPhở tái - 60.000 - 25.000\nTrà đá - 5.000 - 1.000\nChả giò - 30.000 - 12.000",
        required: true,
      },
      { name: "limits", kind: "area", label: "Giới hạn của bạn (tuỳ chọn)", placeholder: "Không giảm quá 15%, chỉ chạy các ngày trong tuần" },
    ],
    notes: ["3 khuyến mãi khác kiểu nhau: combo, tặng món, giảm giá giờ vắng hoặc mua nhiều.", "Giá thường, giá vốn và tiền lãi do hệ thống tự tính từ giá bạn nhập, không để AI tự cộng.", "Mỗi khuyến mãi có câu quảng bá ngắn, dán vào mẫu video Phiếu ưu đãi hoặc Khuyến mãi."],
  },
  "weather-post": {
    type: "weather-post",
    label: "Viết bài theo thời tiết",
    eta: "dưới 1 phút",
    fields: [
      { name: "business", label: "Quán", placeholder: "Phở Cali, Quận 1", required: true },
      { name: "city", label: "Thành phố", hint: "Để lấy thời tiết hôm nay ở đúng nơi quán.", placeholder: "Hà Nội", required: true },
    ],
    notes: ["Thời tiết lấy từ dịch vụ miễn phí, cập nhật theo lúc bạn bấm.", "Nếu không tìm thấy thành phố thì bài được viết theo mùa chung."],
  },
};
