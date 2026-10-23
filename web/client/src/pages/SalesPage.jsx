import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { askNotifyPermission, useJobs } from "../context/JobsContext.jsx";
import { Field, SubmitRow } from "../components/Form.jsx";
import FilePick from "../components/FilePick.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import { api } from "../lib/api.js";
import { getLang } from "../lib/i18n.js";

const FIELDS = [
  ["dish", "Tên món", true],
  ["qty", "Số lượng bán", false],
  ["amount", "Thành tiền (doanh thu)", false],
  ["time", "Giờ bán", false],
];

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Không đọc được file này."));
    r.readAsDataURL(file);
  });

/** "Đọc file bán hàng": an Excel export from the POS → what to post and which promotions to run. */
export default function SalesPage() {
  const navigate = useNavigate();
  const { track } = useJobs();
  const [file, setFile] = useState(null);
  const [dataUrl, setDataUrl] = useState("");
  const [sheet, setSheet] = useState(null); // { headers, rows, preview }
  const [mapping, setMapping] = useState({});
  const [business, setBusiness] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(f) {
    setFile(f);
    setSheet(null);
    setError("");
    if (!f) return;
    setReading(true);
    try {
      const url = await readAsDataUrl(f);
      const read = await api("/sales/read", { method: "POST", body: { dataUrl: url } });
      setDataUrl(url);
      setSheet(read);
      // The owner confirms these: the guesses are only a head start.
      setMapping(Object.fromEntries(FIELDS.map(([k]) => [k, read.mapping[k] ?? ""])));
    } catch (e) {
      setError(e.message);
    } finally {
      setReading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (mapping.dish === "" || mapping.dish == null) return setError("Chọn cột tên món.");
    setBusy(true);
    try {
      askNotifyPermission(); // inside the click: browsers block the prompt otherwise
      const { job } = await api("/sales/analyze", { method: "POST", body: { dataUrl, mapping, business, uiLang: getLang() } });
      track(job);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = sheet ? sheet.headers.map((h, i) => [String(i), h]) : [];

  return (
    <SkillShell id="sales-insight">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <div className="field">
          <span className="field-label">File Excel từ phần mềm bán hàng</span>
          <FilePick accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" file={file} onChange={onFile} placeholder="Chọn file .xlsx hoặc .xls" kind="file" disabled={busy || reading} />
          <small>Dùng sheet đầu tiên, dòng có tên cột ở trên cùng. Tối đa 5 MB. Số liệu được tính trên máy chủ, AI chỉ viết gợi ý.</small>
        </div>
        {reading && <p className="hint">Đang đọc file…</p>}
        {sheet && (
          <>
            <fieldset className="slide-card-fields">
              <legend>Cột nào là gì</legend>
              <p className="hint">Đã đọc {sheet.rows} dòng từ sheet "{sheet.sheet}". Kiểm tra các cột dưới đây, sai thì chọn lại.</p>
              <div className="row">
                {FIELDS.map(([key, label, required]) => (
                  <label className="field" key={key}>
                    <span className="field-label">{label}{required ? " (bắt buộc)" : ""}</span>
                    <select value={mapping[key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}>
                      {!required && <option value="">— không có —</option>}
                      {required && <option value="">— chọn cột —</option>}
                      {options.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="sales-preview">
                <table>
                  <thead><tr>{sheet.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>{sheet.preview.map((r, i) => <tr key={i}>{sheet.headers.map((_, j) => <td key={j}>{String(r[j] ?? "")}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </fieldset>
            <Field label="Tên quán (tuỳ chọn)" hint="Chỉ để hiện trong bài viết, không ảnh hưởng số liệu.">
              <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Phở Cali, Quận 1" autoComplete="off" maxLength={120} />
            </Field>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <SubmitRow busy={busy || reading || !sheet} label="Phân tích doanh số" eta="dưới 1 phút" />
        <Notes items={["Bài này chỉ đếm những gì có trong file: không đoán doanh thu hay món ngoài danh sách.", "Kết quả gồm món nên đăng, món nên khuyến mãi và giờ đông, giờ vắng.", "1 credit mỗi lần phân tích."]} />
      </form>
    </SkillShell>
  );
}
