import { Link } from "react-router-dom";
import { getLang } from "../lib/i18n.js";

// Terms of use and privacy policy. Written from what the app actually does (accounts, Firestore,
// Backblaze B2, Stripe, Twilio, Groq / Gemini); the company should have them reviewed before launch.
// Both languages live here (the runtime dictionary is for short UI strings).

const UPDATED = "18/10/2026";

const TERMS = [
  {
    vi: ["Dịch vụ", "Skipli Content là bộ công cụ dùng AI để nghiên cứu đối thủ, viết bài, dựng video và trả lời khách cho nhà hàng và người bán hàng. Nội dung do AI tạo chỉ để tham khảo: bạn tự kiểm tra trước khi đăng và chịu trách nhiệm về nội dung mình đăng."],
    en: ["The service", "Skipli Content is a set of AI tools that research competitors, write posts, build videos and answer customers for restaurants and small sellers. AI-made content is a draft: check it before you post it, and you are responsible for what you publish."],
  },
  {
    vi: ["Tài khoản", "Mỗi số điện thoại dùng cho một tài khoản. Bạn giữ mật khẩu của mình và chịu trách nhiệm cho mọi hoạt động trong tài khoản. Không tạo nhiều tài khoản để lấy thêm credit dùng thử; tài khoản vi phạm có thể bị khoá."],
    en: ["Your account", "One phone number holds one account. Keep your password safe; you are responsible for what happens in your account. Do not open several accounts to collect more trial credits; accounts that do may be suspended."],
  },
  {
    vi: ["Credit và thanh toán", "Mỗi lượt chạy công cụ trừ credit theo loại việc, bảng giá nằm ở trang Credit. Lượt chạy lỗi hoặc bị huỷ được hoàn credit tự động. Credit mua thêm được thanh toán qua Stripe; web không lưu số thẻ của bạn. Credit đã nạp không đổi lại thành tiền, trừ khi pháp luật yêu cầu."],
    en: ["Credits and payment", "Each run takes credits by type of work; the Credits page lists the prices. Failed or canceled runs get their credits back automatically. Extra credits are paid through Stripe; we never store your card number. Credits bought are not refundable as cash unless the law requires it."],
  },
  {
    vi: ["Sử dụng hợp lệ", "Không dùng dịch vụ để tạo nội dung vi phạm pháp luật, lừa đảo, xúc phạm người khác, vi phạm bản quyền, hoặc để quét dữ liệu trái với điều khoản của các nền tảng. Không tìm cách vượt giới hạn sử dụng hay làm quá tải hệ thống."],
    en: ["Fair use", "Do not use the service for content that is unlawful, deceptive, abusive or infringes someone's rights, or to collect data against a platform's terms. Do not try to get around usage limits or overload the system."],
  },
  {
    vi: ["Nội dung của bạn", "Ảnh, video, âm thanh và thông tin bạn đưa vào vẫn là của bạn. Bạn cho phép dịch vụ xử lý chúng (kể cả gửi tới nhà cung cấp AI) để tạo kết quả cho bạn. Kết quả tạo ra thuộc về bạn để dùng cho việc kinh doanh của mình."],
    en: ["Your content", "Photos, videos, audio and details you add stay yours. You let the service process them (including sending them to AI providers) to make your results. The results are yours to use for your business."],
  },
  {
    vi: ["Thay đổi và chấm dứt", "Dịch vụ có thể thay đổi công cụ, giá credit hoặc các điều khoản này; thay đổi quan trọng sẽ được báo trên web. Bạn có thể ngừng dùng bất cứ lúc nào và yêu cầu xoá tài khoản qua mục Hỗ trợ và góp ý."],
    en: ["Changes and ending", "We may change the tools, the credit prices or these terms; important changes are announced on the site. You can stop at any time and ask for your account to be deleted through Support and feedback."],
  },
  {
    vi: ["Giới hạn trách nhiệm", "Dịch vụ được cung cấp như hiện có. Kết quả AI có thể sai hoặc không phù hợp; trong phạm vi pháp luật cho phép, dịch vụ không chịu trách nhiệm cho thiệt hại gián tiếp từ việc dùng các kết quả này."],
    en: ["Liability", "The service is provided as is. AI results can be wrong or unsuitable; as far as the law allows, we are not liable for indirect losses from using them."],
  },
];

const PRIVACY = [
  {
    vi: ["Thông tin chúng tôi lưu", "Số điện thoại (hoặc email với tài khoản quản trị), tên bạn nhập, mật khẩu đã mã hoá một chiều (không ai đọc được mật khẩu gốc), số credit và lịch sử nạp. Thông tin bạn nhập vào các công cụ và kết quả tạo ra. Mã băm của địa chỉ IP lúc đăng ký, chỉ để giới hạn số tài khoản dùng thử."],
    en: ["What we keep", "Your phone number (or email for admin accounts), the name you enter, your password hashed one way (nobody can read the original), your credits and top-ups. What you type into the tools and the results. A hash of your sign-up IP address, only to limit trial accounts."],
  },
  {
    vi: ["Lưu ở đâu", "Dữ liệu tài khoản và kết quả nằm trên Google Cloud Firestore. Ảnh, video bạn tải lên và file kết quả nằm trên Backblaze B2; file bạn tải lên tự xoá sau 7 ngày. Dữ liệu được sao lưu hằng ngày và giữ bản sao 14 ngày."],
    en: ["Where it is stored", "Account data and results are on Google Cloud Firestore. Photos and videos you upload and result files are on Backblaze B2; your uploads are deleted after 7 days. The data is backed up daily and backups are kept for 14 days."],
  },
  {
    vi: ["Bên thứ ba xử lý dữ liệu", "Nhà cung cấp AI (Groq, Google Gemini) nhận nội dung cần xử lý để tạo kết quả. Twilio gửi mã xác nhận tới số điện thoại của bạn. Stripe xử lý thanh toán; số thẻ do Stripe giữ, không qua máy chủ của chúng tôi. Chúng tôi không bán dữ liệu của bạn."],
    en: ["Who processes it for us", "AI providers (Groq, Google Gemini) receive the content to process so they can make your results. Twilio texts confirmation codes to your phone. Stripe handles payments; your card number stays with Stripe and never reaches our servers. We do not sell your data."],
  },
  {
    vi: ["Cookie", "Web dùng một cookie đăng nhập (giữ 30 ngày) và bộ nhớ trình duyệt cho các tuỳ chọn như giao diện sáng tối, ngôn ngữ. Không dùng cookie quảng cáo hay theo dõi."],
    en: ["Cookies", "The site uses one sign-in cookie (kept 30 days) and browser storage for preferences such as light or dark mode and language. No advertising or tracking cookies."],
  },
  {
    vi: ["Quyền của bạn", "Bạn có thể xem, sửa hoặc xoá dữ liệu của mình: kết quả xoá được ngay trong Lịch sử; muốn xoá tài khoản và toàn bộ dữ liệu, gửi yêu cầu qua mục Hỗ trợ và góp ý."],
    en: ["Your choices", "You can see, change or delete your data: results can be deleted right from History; to delete your account and all its data, send a request through Support and feedback."],
  },
];

export default function LegalPage({ kind }) {
  const en = getLang() === "en";
  const items = kind === "privacy" ? PRIVACY : TERMS;
  const title = kind === "privacy" ? (en ? "Privacy policy" : "Chính sách bảo mật") : en ? "Terms of use" : "Điều khoản sử dụng";
  return (
    <div className="legal" translate="no">
      <header className="plain-head">
        <h1>{title}</h1>
        <p>{en ? `Last updated ${UPDATED}` : `Cập nhật lần cuối ${UPDATED}`}</p>
      </header>
      {items.map((item) => {
        const [h, body] = en ? item.en : item.vi;
        return (
          <section key={item.vi[0]}>
            <h2>{h}</h2>
            <p>{body}</p>
          </section>
        );
      })}
      <p className="legal-other">
        {kind === "privacy" ? <Link to="/terms">{en ? "Terms of use →" : "Điều khoản sử dụng →"}</Link> : <Link to="/privacy">{en ? "Privacy policy →" : "Chính sách bảo mật →"}</Link>}
      </p>
    </div>
  );
}
