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
      ["Dựng video", "Vẽ ảnh từng cảnh, lồng tiếng, chèn phụ đề, ghép thành MP4."],
    ],
    output: ["File MP4 dọc, ngang hoặc vuông", "Trình chiếu ảnh có nhạc, hoặc video AI có giọng đọc", "Kịch bản từng cảnh để chỉnh lại"],
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
  library: {
    perks: ["Mẫu có sẵn", "Bài đã lưu", "Tìm nhanh"],
    steps: [
      ["Chọn mẫu", "Cấu trúc bài viết như PAS, AIDA hay kể chuyện."],
      ["Lưu bài hay", "Giữ lại bài đã viết để dùng lại."],
      ["Tìm lại", "Gõ từ khoá trong thư viện."],
    ],
    output: ["Mẫu cấu trúc bài viết để AI viết theo", "Bài đã lưu dùng lại được"],
  },
  "live-recap": {
    perks: ["Cắt đoạn hay", "Tóm tắt buổi live", "Bài cảm ơn"],
    steps: [
      ["Tải bản ghi", "Video buổi live, MP4 hoặc MOV, tối đa 10 phút."],
      ["Chọn số đoạn", "Số đoạn hay cần cắt, dọc hoặc ngang."],
      ["Đăng lại", "Đăng các đoạn cắt và bài cảm ơn."],
    ],
    output: ["Các đoạn hay đã cắt thành Reels", "Tóm tắt và món được nhắc", "Bài cảm ơn khách sau buổi live"],
  },
  "post-score": {
    perks: ["Điểm từng phần", "Chỉ chỗ cần sửa", "Có bản đã sửa"],
    steps: [
      ["Dán bài", "Bài viết sắp đăng, kèm nền tảng nếu muốn."],
      ["Xem điểm", "Câu mở đầu, nội dung, lời kêu gọi, độ dài, hashtag."],
      ["Dùng bản sửa", "Sao chép bản đã sửa rồi đăng."],
    ],
    output: ["Điểm bài và lý do", "Danh sách sửa nhanh", "Bản đã sửa giữ nguyên giá và ưu đãi"],
  },
  "dish-riddle": {
    perks: ["Có đáp án", "Gợi ý bình luận", "Dựa trên ảnh"],
    steps: [
      ["Nhập quán và món", "Món cần đố và phần nhìn thấy trong ảnh."],
      ["Chọn bài", "Đăng câu đố, để khách đoán."],
      ["Trả lời", "Dùng 2 câu gợi ý cho admin."],
    ],
    output: ["Câu đố kèm vài gợi ý", "3 đáp án để khách chọn", "Đáp án và câu trả lời gợi ý"],
  },
  "story-behind": {
    perks: ["Theo lời chủ quán", "Có lời kể video", "Không bịa"],
    steps: [
      ["Trả lời vài câu hỏi", "Học công thức ở đâu, ai nấu đầu tiên."],
      ["Nhận bài", "Bài đăng, lời kể và caption."],
      ["Chỉnh", "Đổi lời cho đúng giọng quán."],
    ],
    output: ["Bài đăng kể về công thức", "Lời kể 25 giây cho video", "Caption một dòng"],
  },
  "weather-post": {
    perks: ["Theo thời tiết hôm nay", "Gợi ý món hợp trời", "Miễn phí"],
    steps: [
      ["Nhập quán và thành phố", "Để lấy thời tiết đúng nơi quán."],
      ["Nhận bài", "Bài đăng hôm nay và món gợi ý."],
      ["Đăng sớm", "Thời tiết thay đổi nhanh, nên đăng trong ngày."],
    ],
    output: ["Bài đăng nhắc thời tiết hôm nay", "Món hoặc đồ uống hợp trời", "Caption sẵn để dán"],
  },
  "gbp-post": {
    perks: ["Cho Google Maps", "Có nút bấm", "Kèm hỏi đáp"],
    steps: [
      ["Nhập quán và điều muốn giới thiệu", "Món mới, ưu đãi, sự kiện hoặc chính quán."],
      ["Chọn nút bấm", "Đặt bàn, đặt món, gọi ngay, xem thêm hoặc nhận ưu đãi."],
      ["Đăng lên Google", "Vào hồ sơ Google Business của quán, Thêm cập nhật, dán bài và gắn ảnh gợi ý."],
    ],
    output: ["3 bài đăng theo 3 góc khác nhau", "Nút bấm và ảnh nên dùng cho từng bài", "5 câu hỏi đáp cho mục Hỏi đáp"],
  },
  "zalo-message": {
    perks: ["Cho Zalo OA", "Có nút bấm", "Chèn tên khách"],
    steps: [
      ["Chọn mục đích", "Mời khách quay lại, báo ưu đãi, món mới, sinh nhật hoặc sự kiện."],
      ["Ghi thông tin thật", "Ưu đãi, món, ngày áp dụng. AI không tự thêm ưu đãi hay giá."],
      ["Gửi từ Zalo OA", "Dán tiêu đề, nội dung và nút vào tin gửi khách đã quan tâm OA của quán."],
    ],
    output: ["3 tin nhắn theo 3 góc khác nhau", "Tiêu đề, nội dung ngắn và nút cho từng tin", "Gợi ý giờ gửi và số tin mỗi tuần"],
  },
  "promo-plan": {
    perks: ["Tính sẵn tiền lãi", "3 kiểu khuyến mãi", "Dùng giá của bạn"],
    steps: [
      ["Nhập món, giá bán, giá vốn", "Mỗi dòng một món. Thiếu giá vốn thì vẫn có gợi ý nhưng chưa tính được lãi."],
      ["Chọn mục tiêu", "Giờ vắng, tăng giá trị đơn, đẩy món mới hoặc kéo khách quay lại."],
      ["So sánh và chọn", "Mỗi khuyến mãi có giá thường, giá khuyến mãi, giá vốn và lãi mỗi đơn."],
    ],
    output: ["3 khuyến mãi khác kiểu nhau", "Bảng tiền do hệ thống tự tính", "Giờ áp dụng và câu quảng bá ngắn"],
  },
  combos: {
    perks: ["Bấm một lần", "Nhiều công cụ nối nhau", "Credit theo từng bước"],
    steps: [
      ["Chọn gói", "Ra mắt món mới, hoặc Chăm khách tuần này."],
      ["Điền một form", "Ảnh và tên món, hoặc quán trên Google Maps."],
      ["Xem từng bước", "Mỗi bước là một kết quả riêng, mở ra xem và dùng ngay."],
    ],
    output: ["Kết quả của mọi bước trong một trang", "Bước sau dùng kết quả bước trước", "Bước lỗi được hoàn credit"],
  },
  "menu-board": {
    perks: ["Miễn phí", "In A4 hoặc lưu PDF", "Link cố định, sửa là cập nhật"],
    steps: [
      ["Nhập món", "Mỗi dòng một món: tên, giá, mô tả. Dòng có # là tên nhóm."],
      ["Chọn kiểu", "Kem cổ điển, đen sang trọng, xanh vườn hay phố đỏ, thêm logo và màu quán."],
      ["In hoặc tạo link", "In menu A4, hoặc lưu thành menu điện tử kèm mã QR để in lên bàn."],
    ],
    output: ["Menu A4 hai cột, in hoặc lưu PDF", "Menu điện tử mở trên điện thoại, không cần cài app", "Mã QR dẫn tới menu, đổi giá không cần in lại mã"],
  },
  "event-banner": {
    perks: ["Miễn phí", "14 dịp lễ", "5 khổ ảnh"],
    steps: [
      ["Chọn dịp", "Tết, Trung thu, 8/3, 20/10, Giáng sinh, Halloween, khai trương…"],
      ["Thêm ảnh món", "Ảnh nền phủ kín hoặc ảnh trong khung; không có ảnh thì banner chỉ chữ."],
      ["Sửa chữ và tải về", "Câu chính, dòng phụ, ưu đãi có thật, tên quán. Tải PNG đúng khổ."],
    ],
    output: ["Banner PNG đúng khổ Facebook, Instagram, story và Google Business", "Màu và hoạ tiết theo từng dịp lễ", "Chữ do bạn viết, không bịa ưu đãi"],
  },
  qr: {
    perks: ["Miễn phí", "Có logo quán", "Không hết hạn"],
    steps: [
      ["Chọn nội dung", "Link menu, Google Maps, fanpage, Wi-Fi hoặc một dòng chữ."],
      ["Chọn màu và logo", "Kéo thả logo quán vào để đặt ở giữa mã."],
      ["Tải PNG", "Chỉ mã QR, hoặc thẻ dựng bàn có tên quán để in."],
    ],
    output: ["Mã QR PNG sắc nét 1024px", "Thẻ dựng bàn có tên quán và lời nhắc", "Mã Wi-Fi khách quét là vào mạng"],
  },
  "photo-fix": {
    perks: ["Giữ nguyên món", "Nhiều khung một lần", "Chỉ vài giây"],
    steps: [
      ["Tải ảnh món", "Ảnh chụp điện thoại, càng rõ món càng tốt."],
      ["Chọn kiểu màu và khung", "Tự nhiên, ấm, tươi sáng hoặc sang trọng; vuông, 4:5, dọc 9:16, ngang 16:9."],
      ["Tải về", "So sánh trước và sau, tải từng khung về máy."],
    ],
    output: ["Ảnh sáng và màu ngon hơn, món giữ nguyên", "Đúng khung từng mạng xã hội, không cắt mất món", "Ảnh gốc để so sánh"],
  },
  dub: {
    perks: ["Giữ nhịp video", "Tiếng Anh hoặc Việt", "Có phụ đề"],
    steps: [
      ["Tải video", "MP4 hoặc MOV, tối đa 200MB và 10 phút."],
      ["Chọn ngôn ngữ", "Lồng sang tiếng Anh hay tiếng Việt, giọng nam hoặc nữ."],
      ["Tải về", "Một file MP4 có giọng đọc và phụ đề mới."],
    ],
    output: ["Video MP4 đã lồng tiếng", "Phụ đề đúng nhịp từng câu", "Bản dịch từng câu để chỉnh sửa"],
  },
  "reel-cut": {
    perks: ["Tới 10 phút video", "Chọn đoạn bằng lời nói", "Mỗi đoạn một file MP4"],
    steps: [
      ["Tải video dài", "MP4 hoặc MOV, tối đa 200MB."],
      ["Chọn số đoạn", "Số đoạn và độ dài mỗi đoạn, dọc hoặc ngang."],
      ["Đăng ngay", "Tải từng file hoặc đăng lên lịch."],
    ],
    output: ["Các file Reels MP4 đã cắt", "Tiêu đề và lý do chọn từng đoạn", "Mốc thời gian để đối chiếu với video gốc"],
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
