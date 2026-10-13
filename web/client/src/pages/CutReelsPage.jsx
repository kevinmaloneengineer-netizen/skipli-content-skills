import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { uploadVideo } from "../lib/api.js";

const MAX_BYTES = 200 * 1024 * 1024;
const RATIOS = { "9:16": "Dọc 9:16", "16:9": "Ngang 16:9" };

export default function CutReelsPage() {
  const [file, setFile] = useState(null);
  const [count, setCount] = useState("3");
  const [clipSeconds, setClipSeconds] = useState("30");
  const [ratio, setRatio] = useState("9:16");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [submit, busy, error] = useSubmitJob("reel-cut");

  function pick(e) {
    const f = e.target.files?.[0];
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
      await submit({ videoId: up.id, seconds: up.seconds, count: Number(count), clipSeconds: Number(clipSeconds), ratio });
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SkillShell id="reel-cut">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Video dài (MP4 hoặc MOV, tối đa 200MB và 10 phút)</span>
          <label className="file-pick">
            <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={pick} disabled={uploading || busy} />
            <span>{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : "Chọn video từ máy"}</span>
          </label>
        </div>
        <div className="row">
          <Field label="Số đoạn">
            <select value={count} onChange={(e) => setCount(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} đoạn</option>)}
            </select>
          </Field>
          <Field label="Độ dài mỗi đoạn">
            <select value={clipSeconds} onChange={(e) => setClipSeconds(e.target.value)}>
              {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} giây</option>)}
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Khung hình</span>
          <Segmented name="ratio" label="Khung hình" options={RATIOS} value={ratio} onChange={setRatio} />
        </div>
        {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải video…" : "Cắt Reels"} eta="2 đến 5 phút" />
        <Notes items={["AI nghe lời trong video và chọn các đoạn có một ý trọn vẹn, mở đầu gây tò mò.", "Mỗi đoạn là một file MP4 riêng, tải về hoặc đăng ngay.", "Video chỉ có nhạc, không có lời nói thì không cắt được."]} />
      </form>
    </SkillShell>
  );
}
