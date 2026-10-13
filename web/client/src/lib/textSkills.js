// Forms of the text-only skills, all on TextSkillPage: the fields the request needs and the page's notes.
export const TEXT_SKILLS = {
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
