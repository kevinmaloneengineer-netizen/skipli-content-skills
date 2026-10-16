import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SKILLS, skillById } from "../lib/constants.js";
import SkillArt from "./SkillArt.jsx";

/**
 * The login page's left panel: a small "screen" playing a tour of the app by itself. A camera glides
 * over a mock page (760 × 1430 px), zooms in on a tool, a written post, the review analysis and a
 * video, then flies back to the tools and loops; a cursor moves and clicks along the way.
 */

const VW = 760; // the screen's design size; the whole frame is scaled to fit the panel
const VH = 490; // visible height under the browser bar
const MOVE = 1300; // ms the camera takes between two shots

const TILES = ["video", "write", "maps", "reel-cut", "review", "compare"];

/** Shots: the page area to frame [x, y, w, h], how long to stay, where the cursor goes, what it clicks. */
const SCENES = [
  { label: "Chọn công cụ", rect: [16, 128, 728, 352], hold: 2300, cursor: [380, 236], click: "write" },
  { label: "AI viết bài trong vài giây", rect: [16, 496, 728, 314], hold: 2300, cursor: [560, 760] },
  { label: "Phóng to bài viết", rect: [32, 536, 352, 262], hold: 3200, cursor: [300, 770], click: "copy" },
  { label: "Phân tích review khách", rect: [16, 830, 728, 270], hold: 2300, cursor: [600, 930] },
  { label: "Điểm và cảm xúc của khách", rect: [32, 846, 316, 236], hold: 2300, cursor: [250, 1010] },
  { label: "Dựng video từ ảnh món", rect: [16, 1118, 728, 296], hold: 3400, cursor: [134, 1262], click: "play" },
];

const CAPTIONS = [
  "Lẩu bò nhúng giấm nóng hổi cho chiều mưa 🌧️ Ghé quán, nồi đầu tiên tụi mình tặng thêm phần rau nhé!",
  "Bạn đã thử cà phê muối chưa? Vị mặn nhẹ, béo thơm, uống một lần là nhớ cả tuần ☕",
];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Camera transform that frames a page rect inside the screen. */
function shot([x, y, w, h]) {
  const s = Math.min(VW / w, VH / h);
  return { s, tx: -x * s + (VW - w * s) / 2, ty: -y * s + (VH - h * s) / 2 };
}

/** A caption typing itself from the start (run), or shown whole. */
function Typing({ text, run }) {
  const [n, setN] = useState(run ? 0 : text.length);
  useEffect(() => {
    if (!run || n >= text.length) return undefined;
    const t = setTimeout(() => setN(n + 1), 26);
    return () => clearTimeout(t);
  }, [n, run, text]);
  return <>{text.slice(0, n)}{n < text.length && <i className="ls-caret" />}</>;
}

export default function LoginShowcase({ signup, trial }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [k, setK] = useState(0.8); // frame scale
  const [scene, setScene] = useState(0);
  const [clicked, setClicked] = useState(null); // what the cursor clicked in this shot
  const still = reducedMotion();

  // Fit the 760 px frame to the panel width (never above 1.3×).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const fit = () => setK(Math.min(1.3, el.clientWidth / VW));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The camera: glide (with a slight zoom-out mid-flight) to each shot, hold, next; loops.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return undefined;
    const put = ({ s, tx, ty }) => (el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`);
    if (still) {
      put(shot(SCENES[0].rect));
      return undefined;
    }
    let i = 0;
    let from = shot(SCENES[0].rect);
    let started = performance.now();
    let frame = 0;
    put(from);
    const tick = (now) => {
      const sc = SCENES[i];
      const to = shot(sc.rect);
      const t = Math.min(1, (now - started) / MOVE);
      const e = ease(t);
      const dip = 1 - 0.18 * Math.sin(Math.PI * e) * Math.min(1, Math.abs(Math.log(to.s / from.s)) + 0.4);
      put({ s: (from.s + (to.s - from.s) * e) * dip, tx: from.tx + (to.tx - from.tx) * e, ty: from.ty + (to.ty - from.ty) * e });
      if (now - started > MOVE + sc.hold) {
        from = to;
        i = (i + 1) % SCENES.length;
        started = now;
        setScene(i);
        setClicked(null);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  // The cursor arrives about when the camera does, then clicks.
  useEffect(() => {
    const what = SCENES[scene].click;
    if (!what || still) return undefined;
    const t = setTimeout(() => setClicked(what), MOVE + 350);
    return () => clearTimeout(t);
  }, [scene, still]);

  const [cx, cy] = SCENES[scene].cursor;
  const tools = TILES.map(skillById).filter(Boolean);

  return (
    <aside className="login-show">
      <div className="login-orbs" aria-hidden="true"><i /><i /><i /></div>
      <div className="login-copy">
        <span className="login-kicker">Skipli Content</span>
        <h2>{SKILLS.length} công cụ AI làm content cho quán của bạn</h2>
        <ul className="login-perks">
          <li>{signup && trial ? `Tặng ${trial} credit dùng thử` : "Tài khoản riêng cho từng quán"}</li>
          <li>Không cần thẻ</li>
          <li>Kết quả lưu lại</li>
        </ul>
      </div>

      <div className="ls-wrap" ref={wrap} style={{ height: (VH + 34) * k }} aria-hidden="true">
        <div className="ls-frame" style={{ transform: `scale(${k})` }}>
          <div className="ls-bar">
            <span className="ls-dots"><i /><i /><i /></span>
            <span className="ls-url">content.skipli.ai</span>
            <span className="ls-label" key={scene}>{SCENES[scene].label}</span>
          </div>
          <div className="ls-view">
            <div className="ls-canvas" ref={canvas}>
              <div className="ls-nav">
                <span className="ls-logo">S</span><b>Skipli</b><em>Content</em>
                <span className="ls-links"><i>Công cụ</i><i>Tổng quan</i><i>Lịch sử</i></span>
                <span className="ls-cta">+ Tạo content</span>
              </div>
              <div className="ls-hero">Hôm nay bạn muốn <span>làm gì</span>?</div>

              <div className="ls-grid">
                {tools.map((s) => (
                  <div key={s.id} className={clicked === "write" && s.id === "write" ? "ls-tile is-hit" : "ls-tile"} data-tone={s.tone}>
                    <span className="ls-art"><SkillArt id={s.id} /></span>
                    <b>{s.title}</b>
                    <small>{s.short}</small>
                  </div>
                ))}
              </div>

              <div className="ls-result">
                <h4>Kết quả · Viết content AI <span>✓ Hoàn tất</span></h4>
                <div className="ls-posts">
                  {CAPTIONS.map((c, i) => (
                    <div key={c} className="ls-post">
                      <header><span className="ls-avatar">🍲</span><b>Quán Nhà Mây</b><small>Phương án {i + 1}</small></header>
                      <p><Typing key={scene === 1 ? "run" : "all"} text={c} run={!still && scene === 1} /></p>
                      <footer>
                        <span>❤ 1.2K</span><span>💬 86</span>
                        <span className={clicked === "copy" && i === 0 ? "ls-copy is-done" : "ls-copy"}>{clicked === "copy" && i === 0 ? "✓ Đã chép" : "Sao chép"}</span>
                      </footer>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ls-review">
                <div className="ls-score">
                  <b>4.6<span>★</span></b>
                  <small>230 review Google Maps</small>
                  {[["Khen", 72, "#2e9b5f"], ["Bình thường", 18, "#c9a227"], ["Chê", 10, "#d4513a"]].map(([name, v, c]) => (
                    <div key={name} className="ls-meter"><span>{name}</span><i style={{ "--v": `${v}%`, "--c": c }} /><em>{v}%</em></div>
                  ))}
                </div>
                <div className="ls-insight">
                  <h4>Khách khen gì</h4>
                  <div className="ls-chips"><i>Nước dùng đậm vị</i><i>Phục vụ nhanh</i><i>Giá hợp lý</i></div>
                  <h4>Khách chê gì</h4>
                  <div className="ls-chips is-bad"><i>Chỗ đậu xe chật</i><i>Cuối tuần đông</i></div>
                  <blockquote>“Phở ở đây ngon nhất khu, nhân viên rất dễ thương.”</blockquote>
                </div>
              </div>

              <div className={clicked === "play" ? "ls-video is-playing" : "ls-video"}>
                <div className="ls-phone" data-tone="sky">
                  <span className="ls-phone-art"><SkillArt id="video" /></span>
                  <span className="ls-phone-cap">Lẩu bò 199K · Ghé ngay!</span>
                  <span className="ls-play">▶</span>
                  <span className="ls-phone-bar"><i /></span>
                </div>
                <div className="ls-timeline">
                  <h4>Video 0:15 · 5 cảnh</h4>
                  <div className="ls-shots">
                    {["coral", "green", "sky", "violet", "ink"].map((t, i) => <span key={t} data-tone={t} style={{ "--i": i }} />)}
                  </div>
                  <div className="ls-track"><i /></div>
                  <span className="ls-export">⬇ Xuất MP4</span>
                </div>
              </div>

              <span className={clicked ? "ls-cursor is-click" : "ls-cursor"} style={{ transform: `translate(${cx}px, ${cy}px)` }}>
                <svg viewBox="0 0 24 24"><path d="M4 2l16 11-7 1.5L9.5 22z" /></svg>
              </span>
            </div>
          </div>
        </div>
        <span className="login-sticker is-heart">❤ 12.4K</span>
        <span className="login-sticker is-credit">{signup && trial ? `+${trial} credit` : "🔥 Đang trend"}</span>
      </div>

      <div className="ls-steps" aria-hidden="true">
        {SCENES.map((s, i) => <i key={s.label} className={i === scene ? "on" : undefined} />)}
      </div>
    </aside>
  );
}
