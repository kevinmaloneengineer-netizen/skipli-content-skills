import { useState } from "react";
import { Field, Segmented, SubmitRow, useSubmitJob } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { uploadVideo } from "../lib/api.js";

const MAX_BYTES = 200 * 1024 * 1024;
const TARGETS = { vi: "Tiếng Việt", en: "Tiếng Anh (Mỹ)" };
const VOICES = { female: "Giọng nữ", male: "Giọng nam" };

export default function DubPage() {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("en");
  const [voice, setVoice] = useState("female");
  const [sourceLang, setSourceLang] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [submit, busy, error] = useSubmitJob("dub");

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
      await submit({ videoId: up.id, seconds: up.seconds, target, voice, sourceLang });
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SkillShell id="dub">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">Video cần lồng tiếng (MP4 hoặc MOV, tối đa 200MB và 10 phút)</span>
          <label className="file-pick">
            <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={pick} disabled={uploading || busy} />
            <span>{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : "Chọn video từ máy"}</span>
          </label>
        </div>
        <div className="field">
          <span className="field-label">Lồng sang</span>
          <Segmented name="target" label="Lồng sang" options={TARGETS} value={target} onChange={setTarget} />
        </div>
        <div className="row">
          <Field label="Giọng đọc">
            <Segmented name="voice" label="Giọng đọc" options={VOICES} value={voice} onChange={setVoice} />
          </Field>
          <Field label="Ngôn ngữ gốc của video">
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              <option value="">Tự nhận biết</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
            </select>
          </Field>
        </div>
        {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
        <SubmitRow busy={busy || uploading} label={uploading ? "Đang tải video…" : "Lồng tiếng"} eta="2 đến 5 phút" />
        <Notes items={["Mỗi câu được dịch rồi đọc lại đúng lúc câu gốc được nói, nên video giữ nguyên nhịp.", "Phụ đề bản dịch được ghi đè lên khung hình, lời gốc không còn.", "Video không có lời nói rõ thì không lồng tiếng được."]} />
      </form>
    </SkillShell>
  );
}
