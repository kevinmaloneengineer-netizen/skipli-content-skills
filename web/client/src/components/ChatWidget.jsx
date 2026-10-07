import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useJobs } from "../context/JobsContext.jsx";
import { api } from "../lib/api.js";
import { STATUS } from "../lib/constants.js";
import Markdown from "./Markdown.jsx";
import Mascot from "./Mascot.jsx";

const KEY = "assistant-chat";
const NUDGES = ["Xin chào! Cần mình giúp gì không? 👋", "Bí ý tưởng? Hỏi mình nhé 💡", "Nhờ mình viết bài hay quét đối thủ nè ✍️", "Chưa biết dùng công cụ nào? Hỏi mình 🙌"];
const HELLO = { role: "assistant", content: "Chào bạn! Mình là **Trợ lý Skipli**. Hỏi mình cách dùng công cụ nào, xin ý tưởng content, hoặc nhờ mình chạy giúp, ví dụ *\"quét kênh facebook.com/tenkenh\"*." };

function suggestions(path) {
  if (path.startsWith("/jobs/")) return ["Tóm tắt kết quả này giúp mình", "Mình nên làm gì tiếp theo?", "Viết 3 bài từ kết quả này"];
  if (path === "/fb" || path === "/fanpage") return ["Công cụ này chạy thế nào?", "Quét kênh nào thì có ích?"];
  return ["Web này làm được những gì?", "Gợi ý content tuần này cho quán lẩu", "Viết 3 bài Facebook cho quán cà phê"];
}

function ActionCard({ action, onRun }) {
  const { jobs } = useJobs();
  const navigate = useNavigate();
  const job = action.jobId ? jobs.find((j) => j.id === action.jobId) : null;
  const fields = Object.entries(action.input ?? {}).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length));
  return (
    <div className="ai-action" data-tone={action.tone}>
      <div className="ai-action-head">
        <span className="ai-action-dot" />
        <b>{action.skill}</b>
      </div>
      {action.title && <div className="ai-action-title">{action.title}</div>}
      <dl>
        {fields.slice(0, 6).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>
        ))}
      </dl>
      {action.error && <p className="ai-action-err">{action.error}</p>}
      {action.jobId ? (
        <Link className="btn small primary" to={`/jobs/${action.jobId}`}>{job ? `${STATUS[job.status]} · Xem kết quả →` : "Xem kết quả →"}</Link>
      ) : (
        <div className="ai-action-btns">
          {action.valid && <button type="button" className="btn small primary" disabled={action.busy} onClick={onRun}>{action.busy ? "Đang tạo…" : "Chạy"}</button>}
          <button type="button" className="btn small" onClick={() => navigate(action.path)}>Mở công cụ</button>
        </div>
      )}
    </div>
  );
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const { track } = useJobs();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? [HELLO];
    } catch {
      return [HELLO];
    }
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [nudge, setNudge] = useState(false);

  const celebrate = () => {
    setCheer(true);
    setTimeout(() => setCheer(false), 1800);
  };

  // Standing still it reads as decoration, so while closed it waves now and then and a speech
  // bubble pops up with a rotating line (first after 3s, then every 30s) until the chat is opened once.
  const [selfWave, setSelfWave] = useState(false);
  const [line, setLine] = useState(-1);
  useEffect(() => {
    if (open) return;
    let t;
    const loop = () => {
      t = setTimeout(() => {
        setSelfWave(true);
        t = setTimeout(() => {
          setSelfWave(false);
          loop();
        }, 1600);
      }, 7000 + Math.random() * 4000);
    };
    loop();
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem("assistant-nudged");
    } catch {
      /* storage blocked */
    }
    if (open || seen) return;
    let hide;
    const show = () => {
      setLine((n) => n + 1);
      setNudge(true);
      setSelfWave(true);
      hide = setTimeout(() => {
        setNudge(false);
        setSelfWave(false);
      }, 7000);
    };
    const first = setTimeout(show, 3000);
    const every = setInterval(show, 25000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      clearTimeout(hide);
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      setNudge(false);
      try {
        sessionStorage.setItem("assistant-nudged", "1");
      } catch {
        /* storage blocked */
      }
    }
  }, [open]);
  const mood = busy ? "think" : cheer ? "happy" : hover || selfWave ? "wave" : "idle";
  const list = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* storage blocked */
    }
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function send(q) {
    const content = (q ?? text).trim();
    if (!content || busy) return;
    setText("");
    const next = [...msgs, { role: "user", content }];
    setMsgs(next);
    setBusy(true);
    try {
      const history = next.filter((m) => m !== HELLO).map(({ role, content: c }) => ({ role, content: c }));
      const res = await api("/chat", { method: "POST", body: { messages: history, path: pathname } });
      setMsgs((m) => [...m, { role: "assistant", content: res.text || "…", action: res.action }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function run(i) {
    const a = msgs[i].action;
    setMsgs((m) => m.map((x, k) => (k === i ? { ...x, action: { ...a, busy: true } } : x)));
    try {
      const { job } = await api("/jobs", { method: "POST", body: { type: a.type, input: a.input } });
      track(job);
      setMsgs((m) => m.map((x, k) => (k === i ? { ...x, action: { ...a, busy: false, jobId: job.id } } : x)));
      celebrate();
    } catch (e) {
      setMsgs((m) => m.map((x, k) => (k === i ? { ...x, action: { ...a, busy: false, valid: false, error: e.message } } : x)));
    }
  }

  return (
    <>
      {nudge && !open && (
        <button type="button" key={line} className="ai-nudge" onClick={() => setOpen(true)}>
          {NUDGES[line % NUDGES.length]}
        </button>
      )}
      <button type="button" className={open ? "ai-fab open" : "ai-fab"} onClick={() => setOpen((v) => !v)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-label={open ? "Đóng trợ lý" : "Mở trợ lý"} aria-expanded={open}>
        <span className="ai-fab-glow" aria-hidden="true" />
        <Mascot mood={open && !busy && !cheer ? (hover ? "wave" : "idle") : mood} size={112} />
        {open && <span className="ai-fab-x" aria-hidden="true">×</span>}
      </button>
      {open && (
        <section className="ai-panel" role="dialog" aria-label="Trợ lý Skipli">
          <header className="ai-head">
            <span className="ai-avatar"><Mascot mood={mood} size={52} /></span>
            <span className="ai-head-text">
              <b>Trợ lý Skipli</b>
              <small>{busy ? "Đang suy nghĩ…" : "Hỏi về sản phẩm hoặc nhờ chạy công cụ"}</small>
            </span>
            <button type="button" className="ai-new" onClick={() => setMsgs([HELLO])} title="Cuộc trò chuyện mới">Mới</button>
          </header>
          <div className="ai-list" ref={list}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}${m.error ? " error" : ""}`}>
                {m.role === "assistant" ? <Markdown className="md ai-md">{m.content}</Markdown> : <p>{m.content}</p>}
                {m.action && <ActionCard action={m.action} onRun={() => run(i)} />}
              </div>
            ))}
            {busy && (
              <div className="ai-msg assistant ai-thinking"><Mascot mood="think" size={40} /><span className="ai-typing"><i /><i /><i /></span></div>
            )}
          </div>
          {msgs.length <= 2 && !busy && (
            <div className="ai-suggest">
              {suggestions(pathname).map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder="Hỏi hoặc nhờ trợ lý…" aria-label="Tin nhắn" />
            <button type="submit" className="ai-send" disabled={busy || !text.trim()} aria-label="Gửi">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
