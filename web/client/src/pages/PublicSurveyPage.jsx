import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// The guests' page speaks the language the owner chose for it (a US restaurant: English), whatever the
// language of the app on this phone.
const WORDS = {
  vi: {
    title: "Góp ý cho quán",
    food: "Món ăn hôm nay thế nào?",
    service: "Phục vụ thế nào?",
    back: "Bạn có quay lại không?",
    backs: { yes: "Chắc chắn", maybe: "Có thể", no: "Không" },
    comment: "Muốn nhắn gì thêm cho quán? (không bắt buộc)",
    commentPh: "Món nào ngon, chỗ nào chưa ổn…",
    contact: "Số điện thoại hoặc email để quán liên hệ lại (không bắt buộc)",
    send: "Gửi góp ý",
    sending: "Đang gửi…",
    thanks: "Cảm ơn bạn đã góp ý!",
    thanksSub: "Quán đọc từng góp ý để làm tốt hơn.",
    closed: "Quán đang tạm dừng nhận góp ý.",
    stars: (n) => `${n} sao`,
    note: "Góp ý chỉ gửi tới chủ quán, không cần đăng nhập.",
    needStars: "Chọn số sao cho món ăn và phục vụ nhé.",
    needBack: "Chọn bạn có quay lại không nhé.",
  },
  en: {
    title: "Tell us how we did",
    food: "How was the food today?",
    service: "How was the service?",
    back: "Would you come back?",
    backs: { yes: "Definitely", maybe: "Maybe", no: "No" },
    comment: "Anything else for us? (optional)",
    commentPh: "What you loved, what we can do better…",
    contact: "Phone or email if you'd like us to follow up (optional)",
    send: "Send feedback",
    sending: "Sending…",
    thanks: "Thank you for your feedback!",
    thanksSub: "We read every note to do better.",
    closed: "This restaurant is not taking feedback right now.",
    stars: (n) => `${n} star${n > 1 ? "s" : ""}`,
    note: "Your feedback goes to the owner only. No sign-in needed.",
    needStars: "Please rate the food and the service.",
    needBack: "Please tell us if you'd come back.",
  },
};

function Stars({ label, value, onChange, w }) {
  return (
    <fieldset className="ps-q">
      <legend>{label}</legend>
      <div className="ps-stars" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={w.stars(n)} className={n <= value ? "on" : undefined} onClick={() => onChange(n)}>★</button>
        ))}
      </div>
    </fieldset>
  );
}

/** /f/:id: the table survey guests open from the QR code. No login, no app chrome. */
export default function PublicSurveyPage() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ food: 0, service: 0, back: "", comment: "", contact: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    fetch(`/api/public/surveys/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Không mở được trang góp ý");
        setSurvey(data.survey);
        document.title = data.survey.name;
        document.documentElement.lang = data.survey.lang === "en" ? "en" : "vi";
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <main className="public-survey is-empty"><p>{error}</p></main>;
  if (!survey) return <main className="public-survey is-empty"><span className="spinner" aria-label="…" /></main>;
  const w = WORDS[survey.lang] ?? WORDS.vi;
  const set = (k) => (v) => {
    setProblem(""); // the last "please rate…" goes once the guest changes something
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function submit(e) {
    e.preventDefault();
    setProblem("");
    if (!form.food || !form.service) return setProblem(w.needStars);
    if (!form.back) return setProblem(w.needBack);
    setBusy(true);
    try {
      const r = await fetch(`/api/public/surveys/${encodeURIComponent(id)}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 429) throw new Error(data.error || "Chưa gửi được, thử lại nhé.");
      setDone(true); // 429 = already sent from here: thanked all the same
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="public-survey">
      <div className="ps-card">
        <span className="ps-kicker">{w.title}</span>
        <h1>{survey.name}</h1>
        {!survey.open ? (
          <p className="ps-intro">{w.closed}</p>
        ) : done ? (
          <div className="ps-done" role="status">
            <span className="ps-check" aria-hidden="true">✓</span>
            <h2>{w.thanks}</h2>
            <p>{survey.thanks || w.thanksSub}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {survey.intro && <p className="ps-intro">{survey.intro}</p>}
            <Stars label={w.food} value={form.food} onChange={set("food")} w={w} />
            <Stars label={w.service} value={form.service} onChange={set("service")} w={w} />
            <fieldset className="ps-q">
              <legend>{w.back}</legend>
              <div className="ps-choices" role="radiogroup" aria-label={w.back}>
                {Object.entries(w.backs).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={form.back === k} className={form.back === k ? "on" : undefined} onClick={() => set("back")(k)}>{label}</button>
                ))}
              </div>
            </fieldset>
            <label className="ps-field">
              <span>{w.comment}</span>
              <textarea rows={3} maxLength={500} value={form.comment} onChange={(e) => set("comment")(e.target.value)} placeholder={w.commentPh} />
            </label>
            <label className="ps-field">
              <span>{w.contact}</span>
              <input maxLength={100} value={form.contact} onChange={(e) => set("contact")(e.target.value)} autoComplete="off" />
            </label>
            {/* Left empty by people (it is off screen); a bot that fills every field gives itself away. */}
            <input className="ps-trap" tabIndex={-1} aria-hidden="true" autoComplete="off" value={form.website} onChange={(e) => set("website")(e.target.value)} name="website" />
            {problem && <p className="ps-problem" role="alert">{problem}</p>}
            <button className="ps-send" disabled={busy}>{busy ? w.sending : w.send}</button>
            <small className="ps-note">{w.note}</small>
          </form>
        )}
      </div>
    </main>
  );
}
