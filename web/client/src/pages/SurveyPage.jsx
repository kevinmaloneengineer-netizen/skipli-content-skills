import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Field } from "../components/Form.jsx";
import SkillShell, { Notes } from "../components/SkillShell.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { api } from "../lib/api.js";
import { ago } from "../lib/format.js";
import { useCopy, useToast } from "../context/ToastContext.jsx";

const link = (id) => `${window.location.origin}/f/${id}`;
const BLANK = { name: "", intro: "", thanks: "", lang: "vi", alert: true, praise: true, open: true };
const BACK = { yes: "Chắc chắn quay lại", maybe: "Có thể quay lại", no: "Không quay lại" };
const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

/** "Khảo sát tại bàn": the owner makes the QR, reads the averages and the guests' notes. Free. */
export default function SurveyPage() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const load = () => api("/surveys").then((d) => { setList(d.surveys); setOpenId((cur) => cur ?? d.surveys[0]?.id ?? null); }, (e) => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function create(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { survey } = await api("/surveys", { method: "POST", body: form });
      setForm(BLANK);
      setOpenId(survey.id);
      toast("Đã tạo khảo sát. In mã QR đặt lên bàn là khách góp ý được ngay.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SkillShell id="survey" wide>
      {list?.map((s) => <SurveyCard key={s.id} item={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} onChanged={load} />)}
      <form className="form-card" onSubmit={create} noValidate>
        <h2>{list?.length ? "Thêm khảo sát" : "Tạo khảo sát cho quán"}</h2>
        <div className="row">
          <Field label="Tên quán (khách thấy trên trang góp ý)"><input className="input-lg" value={form.name} onChange={set("name")} placeholder="Phở Cali" required /></Field>
          <Field label="Ngôn ngữ trang khách">
            <select value={form.lang} onChange={set("lang")}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English (quán ở Mỹ)</option>
            </select>
          </Field>
        </div>
        <Field label="Lời mở đầu (tuỳ chọn)"><input value={form.intro} onChange={set("intro")} maxLength={160} placeholder="Góp ý 30 giây giúp quán làm món ngon hơn mỗi ngày" /></Field>
        <Field label="Lời cảm ơn sau khi gửi (tuỳ chọn)"><input value={form.thanks} onChange={set("thanks")} maxLength={160} placeholder="Cảm ơn bạn! Lần sau ghé nhớ nhắc nhân viên nhé." /></Field>
        <label className="survey-check"><input type="checkbox" checked={form.alert} onChange={set("alert")} /> Gửi email cho tôi ngay khi có góp ý chưa tốt (món hoặc phục vụ từ 2 sao trở xuống, hoặc khách nói không quay lại)</label>
        <label className="survey-check"><input type="checkbox" checked={form.praise} onChange={set("praise")} /> Gửi email khi khách khen (món và phục vụ từ 4 sao, chắc chắn quay lại)</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !form.name.trim()}>{busy ? "Đang tạo…" : "Tạo khảo sát và mã QR"}</button>
        <Notes items={["Miễn phí, không trừ credit. Khách quét mã QR, chấm sao món ăn và phục vụ, chọn có quay lại không, để lại lời nhắn nếu muốn.", "Khách không cần đăng nhập. Web không lưu địa chỉ IP của khách; số điện thoại hay email chỉ có khi khách tự ghi.", "Email báo góp ý chưa tốt và email khi khách khen: mỗi loại tối đa 1 lần mỗi giờ cho mỗi khảo sát. Góp ý chưa tốt để bạn liên hệ lại khách trước khi họ viết review xấu."]} />
      </form>
    </SkillShell>
  );
}

function SurveyCard({ item, open, onToggle, onChanged }) {
  const toast = useToast();
  const copy = useCopy();
  const [qr, setQr] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [removing, setRemoving] = useState(false);
  const s = item.survey;
  const st = item.stats;

  useEffect(() => {
    QRCode.toDataURL(link(item.id), { errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#1c1a16", light: "#ffffff" } }).then(setQr, () => setQr(""));
  }, [item.id]);
  useEffect(() => {
    if (!open) return;
    api(`/surveys/${item.id}/answers?days=${days}`).then(setData, (e) => toast(e.message));
  }, [open, days, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(patch, message) {
    try {
      await api(`/surveys/${item.id}`, { method: "PUT", body: { ...s, ...patch } });
      toast(message);
      onChanged();
    } catch (err) {
      toast(err.message);
    }
  }
  async function remove() {
    try {
      await api(`/surveys/${item.id}`, { method: "DELETE" });
      toast("Đã xoá khảo sát và các góp ý của nó");
      onChanged();
    } catch (err) {
      toast(err.message);
    }
  }
  function downloadQr() {
    const a = document.createElement("a");
    a.href = qr;
    a.download = "qr-gop-y.png";
    a.click();
  }
  const view = data?.stats ?? st;
  const answers = (data?.answers ?? []).filter((a) => !onlyLow || a.low);

  return (
    <section className={`card survey-card${s.open ? "" : " is-off"}`}>
      <div className="survey-head">
        <div>
          <h2>{s.name}</h2>
          <small>{s.open ? "Đang nhận góp ý" : "Đang tạm dừng"}{" · "}{`${item.total} góp ý từ trước tới nay`}{st.lastAt ? ` · mới nhất ${ago(st.lastAt)}` : ""}</small>
        </div>
        <button type="button" className="btn small" onClick={onToggle} aria-expanded={open}>{open ? "Thu gọn" : "Xem góp ý"}</button>
      </div>
      <div className="survey-stats">
        <div><b>{view.count}</b><span>{`góp ý ${data ? `${days} ngày` : "30 ngày"}`}</span></div>
        <div><b>{view.food ?? "—"}</b><span>sao món ăn</span></div>
        <div><b>{view.service ?? "—"}</b><span>sao phục vụ</span></div>
        <div><b>{view.backYes == null ? "—" : `${view.backYes}%`}</b><span>chắc chắn quay lại</span></div>
        <div className={view.low ? "is-low" : undefined}><b>{view.low}</b><span>góp ý chưa tốt</span></div>
      </div>
      {open && (
        <div className="survey-body">
          <div className="survey-qr">
            {qr && <img src={qr} alt={`Mã QR góp ý của ${s.name}`} width="180" height="180" />}
            <div>
              <p className="hint">In mã này dán lên bàn hoặc kẹp vào hoá đơn, kèm dòng "Quét để góp ý cho quán".</p>
              <div className="survey-actions">
                <button type="button" className="btn small" onClick={downloadQr} disabled={!qr}>Tải mã QR</button>
                <button type="button" className="btn small" onClick={() => copy(link(item.id))}>Chép link</button>
                <a className="btn small" href={link(item.id)} target="_blank" rel="noopener noreferrer">Mở trang khách</a>
              </div>
              <div className="survey-actions">
                <button type="button" className="btn small" onClick={() => save({ open: !s.open }, s.open ? "Đã tạm dừng nhận góp ý" : "Đã mở lại nhận góp ý")}>{s.open ? "Tạm dừng" : "Mở lại"}</button>
                <button type="button" className="btn small" onClick={() => save({ alert: !s.alert }, s.alert ? "Đã tắt email báo góp ý chưa tốt" : "Đã bật email báo góp ý chưa tốt")}>{s.alert ? "Tắt email báo" : "Bật email báo"}</button>
                <button type="button" className="btn small" onClick={() => save({ praise: s.praise === false }, s.praise === false ? "Đã bật email khi khách khen" : "Đã tắt email khi khách khen")}>{s.praise === false ? "Bật email khen" : "Tắt email khen"}</button>
                <button type="button" className="btn small danger" onClick={() => setRemoving(true)}>Xoá</button>
              </div>
            </div>
          </div>
          <div className="survey-filter">
            <div className="seg" role="radiogroup" aria-label="Khoảng thời gian">
              {[7, 30, 90].map((d) => <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "on" : undefined} onClick={() => setDays(d)}>{`${d} ngày`}</button>)}
            </div>
            <label className="survey-check"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Chỉ góp ý chưa tốt</label>
          </div>
          {data && !answers.length && <p className="hint">{onlyLow ? "Không có góp ý chưa tốt nào trong khoảng này." : "Chưa có góp ý nào trong khoảng này. In mã QR đặt lên bàn để khách bắt đầu góp ý."}</p>}
          <ul className="survey-answers">
            {answers.map((a) => (
              <li key={a.id} className={a.low ? "is-low" : undefined}>
                <div className="survey-answer-top">
                  <span title="Món ăn">{`Món ${stars(a.food)}`}</span>
                  <span title="Phục vụ">{`Phục vụ ${stars(a.service)}`}</span>
                  <span>{BACK[a.back]}</span>
                  <small>{ago(a.createdAt)}</small>
                </div>
                {a.comment && <p>{a.comment}</p>}
                {a.contact && <small className="survey-contact">{`Liên hệ: ${a.contact}`}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {removing && (
        <ConfirmDialog
          title="Xoá khảo sát này?"
          body="Mã QR đã in sẽ không mở được nữa và mọi góp ý của khảo sát này bị xoá theo. Muốn ngừng tạm thời thì bấm Tạm dừng."
          okLabel="Xoá khảo sát"
          onOk={remove}
          onClose={() => setRemoving(false)}
        />
      )}
    </section>
  );
}
