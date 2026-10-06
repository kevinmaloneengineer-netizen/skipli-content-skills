import { useEffect, useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";

const COUNTS = { 3: "3 reel", 5: "5 reel", 10: "10 reel" };
const DEPTHS = { 100: "100 reel mới nhất", 10: "10 reel mới nhất" };

export default function FbScanPage() {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [top, setTop] = useState("5");
  const [depth, setDepth] = useState("100");
  const [can100, setCan100] = useState(true);
  const isSingleReel = /\/reel\/\d|fb\.watch|\/videos\//i.test(url);

  // The server reports whether the 100-reel scan is available (it is by default: free logged-out paging).
  useEffect(() => {
    api("/health").then(
      ({ sources }) => {
        setCan100(Boolean(sources?.facebook100));
        if (!sources?.facebook100) setDepth("10");
      },
      () => {},
    );
  }, []);
  const [submit, busy, error] = useSubmitJob("fb-reels");

  function onSubmit(e) {
    e.preventDefault();
    submit({ url, topic, top: Number(top), depth: Number(depth) });
  }

  return (
    <SkillShell id="reels">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <Field label="Link kênh hoặc link reel" hint="Link kênh → xếp hạng cả kênh. Link một reel → phân tích riêng reel đó.">
          <input className="input-lg" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="facebook.com/tenkenh/reels" autoComplete="off" required autoFocus />
        </Field>
        <div className="row">
          <Field label="Chủ đề (tuỳ chọn)">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="SEO, nấu ăn, skincare…" />
          </Field>
          <div className="field">
            <span className="field-label">Lấy bao nhiêu reel</span>
            <Segmented name="top" label="Số reel" options={COUNTS} value={top} onChange={setTop} />
          </div>
        </div>
        {!isSingleReel && (
          <div className="field">
            <span className="field-label">Phạm vi quét</span>
            <Segmented name="depth" label="Phạm vi quét" options={can100 ? DEPTHS : { 10: DEPTHS[10] }} value={depth} onChange={setDepth} />
            <small>
              {depth === "100"
                ? "Quét 100 reel mới nhất của kênh, xếp hạng theo tương tác rồi AI xem các video nổi bật. Miễn phí, không cần đăng nhập."
                : can100
                  ? "Nhanh hơn: chỉ 10 reel mới đăng gần đây nhất."
                  : "Máy chủ chưa cấu hình nguồn dữ liệu nên hiện chỉ quét được ~10 reel mới nhất."}
            </small>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy} label="Bắt đầu quét" eta={isSingleReel ? "1 phút" : depth === "100" ? "5 đến 10 phút" : "3 đến 5 phút"} />
        <Notes
          items={[
            "Chỉ cần dán link, hệ thống tự lấy danh sách reel mà không cần đăng nhập Facebook.",
            "Xếp hạng theo cảm xúc + 2×bình luận + 3×chia sẻ, rồi AI xem video để chọn bài hay nhất.",
            "Chỉ để tham khảo, không re-up video của người khác.",
          ]}
        />
      </form>
    </SkillShell>
  );
}
