import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { uploadVideo } from "../lib/api.js";
import FilePick from "../components/FilePick.jsx";

const MAX_BYTES = 200 * 1024 * 1024;
const RATIOS = { "9:16": "Dọc 9:16", "16:9": "Ngang 16:9" };

export default function LiveRecapPage() {
  const [file, setFile] = useState(null);
  const [count, setCount] = useState("3");
    const [ratio, setRatio] = useState("9:16");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [submit, busy, error] = useSubmitJob("live-recap");

  function pick(f) {
    setLocalError("");
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) return setLocalError("Video lớn quá 200MB. Hãy nén hoặc cắt bớt rồi thử lại.");
    if (!/\.(mp4|mov)$/i.test(f.name) && !/video\/(mp4|quicktime)/.test(f.type)) return setLocalError("Chỉ nhận file MP4 hoặc MOV.");
    setFile(f);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return setLocalError("Chọn một video trước.");
    setLocalError("");
    setUploading(true);
    try {
      const up = await uploadVideo(file);
      await submit({ videoId: up.id, seconds: up.seconds, count: Number(count), ratio });
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SkillShell id="live-recap">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Video buổi livestream (MP4 hoặc MOV, tối đa 200MB và 10 phút)</span>
          <FilePick accept="video/mp4,video/quicktime,.mp4,.mov" file={file} onChange={pick} placeholder="Chọn video từ máy" kind="video" disabled={uploading || busy} />
        </div>
        <div className="row">
          <Field label="Số đoạn hay cần cắt">
            <select value={count} onChange={(e) => setCount(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} đoạn</option>)}
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Khung hình</span>
          <Segmented name="ratio" label="Khung hình" options={RATIOS} value={ratio} onChange={setRatio} />
        </div>
        {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải video…" : "Tóm tắt livestream"} eta="2 đến 5 phút" />
        <Notes items={["AI nghe lời trong buổi live, cắt các đoạn hay nhất thành Reels dọc.", "Kèm tóm tắt buổi live, danh sách món hoặc sản phẩm được nhắc, và một bài cảm ơn khách.", "Bản ghi dài hơn 10 phút thì cắt bớt trước khi tải lên."]} />
      </form>
    </SkillShell>
  );
}
