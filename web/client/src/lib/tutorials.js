// YouTube tutorial for each tool (playlist "Skipli Content Tutorials" on the SkipliContent channel).
// Skill id → YouTube video id. Tools not listed simply show no video.
import { getLang } from "./i18n.js";

export const TUTORIALS = {
  reels: "88YEmi7V-Dk", // Quét Reels đối thủ
  threads: "pieKiPWnZ3g", // Content viral Threads
  write: "sof2zNRM2_M", // Viết content AI
  clone: "9kKEs95wRtw", // Nhân bản kênh đối thủ
  video: "wUI8-T2e4IA", // Tạo video AI
  library: "oEI_97YMO54", // Thư viện mẫu content
  combos: "xAsVaH7rX7M", // Gói chạy liền
  "menu-board": "eII0tZEo1LQ", // Menu in và menu điện tử
  survey: "GD-czyV_uEQ", // Khảo sát khách tại bàn
  "event-banner": "iCsnOSR6csg", // Banner sự kiện và lễ
  qr: "ViSL5ey06eE", // Mã QR cho quán
  tiktok: "GL_2KIStO7o", // Content viral TikTok
  compare: "mtcnOjdKmQE", // So sánh đối thủ
  maps: "V8nFxGAM5EY", // Phân tích review Google Maps
  yelp: "Vb7I8gx-mb0", // Phân tích review Yelp
  instagram: "mUXk8_fMpMY", // Phân tích Instagram đối thủ
  fanpage: "fYejS4ZcKGQ", // Phân tích fanpage đối thủ
  image: "LgBUCPu2xfY", // Tạo ảnh quảng cáo AI
  schedule: "8PpxOARa-6U", // Lên lịch đăng bài
  livestream: "VlcUMW7dSXk", // Kịch bản livestream bán hàng
  campaign: "4iGoS0rKp7Q", // Chiến dịch tuần 1 chạm
  menu: "XXA9gbDxbZI", // Viết menu và mô tả món
  review: "eAJ7_GVEsRk", // Trả lời review khách
  inbox: "Lh9DjQmKej4", // Kịch bản inbox chốt đơn
  hashtag: "--CWQtvd2-c", // Hashtag và giờ đăng
  "reel-cut": "xE_0aTMJowA", // Cắt video dài thành Reels
  dub: "CuYjttKcn18", // Lồng tiếng và phụ đề
  "live-recap": "6kmXMn8O6LQ", // Tóm tắt sau livestream
  "post-score": "q4dTMcET8Zo", // Chấm điểm bài trước khi đăng
  "dish-riddle": "E3jsu-CIbew", // Đố vui đoán món
  "story-behind": "rXtPPLvDJ-s", // Câu chuyện đằng sau công thức
  "weather-post": "ub3evrwaxOo", // Thời tiết hôm nay thành bài đăng
  "gbp-post": "eGIO2uFFWPw", // Bài đăng Google Business
  "zalo-message": "bvEGhI7gIsQ", // Tin nhắn Zalo cho khách quen
  "delivery-menu": "RsGdRWdHGQ8", // Menu cho DoorDash, Uber Eats, Grubhub
  "us-occasions": "Ejvz92vIzxo", // Lịch dịp lễ và National Food Days
  "nextdoor-post": "6oln-XK7fWY", // Bài đăng Nextdoor
  "shop-about": "xiwCZPV1SWw", // Viết phần giới thiệu quán
  "sales-insight": "Foyh4ewQa0s", // Đọc file bán hàng ra gợi ý
  "promo-plan": "mK6Xp3mv3h0", // Gợi ý khuyến mãi có tính lãi
  nearby: "T_EJ1zSu3QY", // Đối thủ quanh quán
  "review-compare": "tqFC0Z5Mozo", // So sánh review nhiều quán
  trends: "-25VEnYfAaY", // Nhu cầu tìm kiếm theo khu vực
  "photo-fix": "cuCeKP5AI9k", // Chỉnh ảnh món như studio
};

// English versions (English UI, inputs and results), shown when the site is in English.
export const TUTORIALS_EN = {
  reels: "diJ30bIx8Bw", // Scan Competitor Reels
  threads: "ubNSXJhhfEo", // Find Viral Threads Posts
  write: "afN8r_o998s", // AI Content Writer
  clone: "tPKf3n4s28Y", // Clone a Competitor's Channel
  video: "Eop6olDa-2Y", // AI Video Maker
  library: "TsLd4sulBjg", // Content Template Library
  combos: "WgvIbGQEwOs", // Combos: Run Several Tools at Once
  "menu-board": "QwXH7IGAaTI", // Printed Menu and Digital Menu
  survey: "tlTZk5vUd88", // Table Survey for Guest Feedback
  "event-banner": "MV9JWG6qqvQ", // Event and Holiday Banners
  qr: "OfpbtgP6mmg", // QR Code for Your Restaurant
  tiktok: "cAdK9IBmStA", // Find Viral TikTok Videos
  compare: "YZO9NxRjn58", // Compare Competitors
  maps: "LHzzNQYlnfs", // Google Maps Review Analysis
  yelp: "8FBkiVnwVks", // Yelp Review Analysis
  instagram: "UpzCPb0zfBg", // Instagram Competitor Analysis
  fanpage: "1vuDzNss1Ro", // Facebook Page Competitor Analysis
  image: "Ua4eRH1d3u8", // AI Ad Image Generator
  schedule: "CRA2rlk5k2Q", // Schedule Posts
  livestream: "rg71X1kJA-4", // Livestream Sales Script
  campaign: "R9x4VYFa5q0", // One-Click Weekly Campaign
  menu: "KY2FB-CEBXg", // Menu and Dish Description Writer
  review: "zfxMSycCAB0", // Reply to Customer Reviews
  inbox: "3Of8e4kW8PM", // Inbox Reply Scripts that Close Orders
  hashtag: "zVPHQhyXVpY", // Hashtags and Best Posting Times
  "reel-cut": "bih08rGbV9c", // Cut a Long Video into Reels
  dub: "fRldTxcVJ_E", // Dubbing and Subtitles
  "live-recap": "zlcNTMIde7U", // Post-Livestream Recap
  "post-score": "_O8_Gkc4GjA", // Score Your Post Before Publishing
  "dish-riddle": "6I8d4DcN-Bg", // Guess-the-Dish Quiz Posts
  "story-behind": "Dmsq7zMWwik", // The Story Behind Your Recipe
  "weather-post": "mmxZNB3epGA", // Turn Today's Weather into a Post
  "gbp-post": "OC_PF7ZFhxc", // Google Business Profile Posts
  "zalo-message": "8jhlMcmB-9Q", // Zalo Messages for Regular Customers
  "delivery-menu": "p33ZwR1xrAc", // Menus for DoorDash, Uber Eats and Grubhub
  "us-occasions": "WYo7_RvZf70", // U.S. Holidays and National Food Days
  "nextdoor-post": "SN6i9iDOxPQ", // Nextdoor Posts
  "shop-about": "u87vmF-K4IA", // Restaurant About Section Writer
  "sales-insight": "cLsRqPCrSVc", // Read Your Sales File for Ideas
  "promo-plan": "VvZ-PL7t-W0", // Profit-Aware Promotion Ideas
  nearby: "pHq7di7WGC0", // Competitors Near Your Restaurant
  "review-compare": "QJxYSkt-Ty4", // Compare Reviews Across Restaurants
  trends: "-7ioQRvnuN0", // Local Search Demand
  "photo-fix": "_djdN218_wE", // Studio-Style Food Photo Editing
};

/** The video for this tool in the site's language; the Vietnamese one when there is no English version yet. */
export function tutorialFor(id) {
  return (getLang() === "en" && TUTORIALS_EN[id]) || TUTORIALS[id] || null;
}
