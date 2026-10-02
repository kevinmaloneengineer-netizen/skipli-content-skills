import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/text.js";

// Toy "social post" stickers around the home heading. They only react to the
// pointer when you hover or click one - each has its own hover and click effect.
// Outer .sticker = position + scroll burst (--p, --dx/--dy/--dr); inner = idle bob.

const Heart = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z" /></svg>
);
const Bubble = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>
);
const Repost = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4" /></svg>
);

/** A counter that bumps a key on every fire, so CSS one-shot animations replay. */
function useShot(ms = 900) {
  const [shot, setShot] = useState(0);
  const [live, setLive] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  const fire = () => {
    setShot((n) => n + 1);
    setLive(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setLive(false), ms);
  };
  return [shot, live, fire];
}

/** n particles flying out at evenly spread angles; replays when `shot` changes. */
function Burst({ shot, live, n = 8, children, dist = 56, className = "" }) {
  if (!live) return null;
  return (
    <span key={shot} className={`burst ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ "--a": `${(360 / n) * i + (shot * 17) % 30}deg`, "--dist": `${dist + (i % 3) * 10}px` }}>
          {children}
        </i>
      ))}
    </span>
  );
}

function Sticker({ cls, d, bob, dx, dy, dr, label, onClick, children, extra }) {
  return (
    <div className={`sticker ${cls}`} style={{ "--d": d, "--dx": dx, "--dy": dy, "--dr": dr }}>
      <button type="button" className="sticker-inner" style={{ "--bob": `${bob}s` }} onClick={onClick} aria-label={label} tabIndex={-1}>
        {children}
      </button>
      {extra}
    </div>
  );
}

function Likes() {
  const [liked, setLiked] = useState(false);
  const [shot, live, fire] = useShot();
  return (
    <Sticker
      cls={`st-likes${liked ? " is-on" : ""}`} d={1.1} bob={0} dx={-340} dy={-220} dr={-24} label="Thích"
      onClick={() => { setLiked((v) => !v); if (!liked) fire(); }}
      extra={<><Burst shot={shot} live={live} n={9} className="burst-hearts"><Heart /></Burst>{live && <span key={shot} className="float-up">+1</span>}</>}
    >
      <span className="heart-icon"><Heart /></span> 12.4K
    </Sticker>
  );
}

function Play() {
  const [playing, setPlaying] = useState(false);
  const [shot, live, fire] = useShot(1100);
  return (
    <Sticker
      cls={`st-play${playing ? " is-on" : ""}`} d={1.6} bob={1.2} dx={300} dy={-260} dr={30} label={playing ? "Tạm dừng" : "Phát"}
      onClick={() => { setPlaying((v) => !v); fire(); }}
    >
      {/* ripples + progress arc live inside the button so they follow its bob, tilt and scale */}
      {live && <span key={shot} className="ripples" aria-hidden="true"><i /><i /><i /></span>}
      {playing && <span className="play-arc" aria-hidden="true" />}
      <span key={playing ? "pause" : "play"} className={shot ? "play-icon pop" : "play-icon"}>
        {playing ? <span className="pause-bars"><i /><i /></span> : <span className="play-tri" />}
      </span>
      {playing && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}
    </Sticker>
  );
}

function Share() {
  const [count, setCount] = useState(1200);
  const [shot, live, fire] = useShot();
  return (
    <Sticker
      cls="st-share" d={1.9} bob={2.4} dx={-120} dy={-340} dr={-20} label="Chia sẻ"
      onClick={() => { setCount((c) => c + 1); fire(); }}
      extra={live && <span key={shot} className="float-up">+1</span>}
    >
      <span key={shot} className={shot ? "share-icon spin" : "share-icon"}><Repost /></span>
      {count === 1200 ? "1.2K" : count.toLocaleString("vi-VN")}
    </Sticker>
  );
}

function Tag() {
  const [shot, live, fire] = useShot(1400);
  return (
    <Sticker
      cls="st-tag" d={0.8} bob={0.6} dx={380} dy={40} dr={14} label="Sao chép hashtag"
      onClick={() => { copyText("#bánhàngonline"); fire(); }}
      extra={live && <span key={shot} className="tip">Đã copy!</span>}
    >
      <span key={shot} className={shot ? "tag-text stamp" : "tag-text"}>#bánhàngonline</span>
    </Sticker>
  );
}

const REPLIES = ["Hay quá, xin link với 🙏", "Mình cũng bị y chang 😭", "Lưu lại học dần!", "Shop ơi ib mình nha"];

function Comment() {
  const [count, setCount] = useState(328);
  const [shot, live, fire] = useShot(2200);
  return (
    <Sticker
      cls="st-comment" d={1.3} bob={1.8} dx={-400} dy={120} dr={-12} label="Bình luận"
      onClick={() => { setCount((c) => c + 1); fire(); }}
      extra={live && <span key={shot} className="reply">{REPLIES[(shot - 1) % REPLIES.length]}</span>}
    >
      <span className="st-avatar" />
      <span className="st-lines"><i /><i /></span>
      <span className="st-count"><Bubble /> {count}</span>
    </Sticker>
  );
}

const BAR_SETS = [[30, 48, 40, 72, 100], [62, 34, 88, 50, 100], [44, 70, 56, 92, 100], [80, 52, 64, 38, 100]];

function Chart() {
  const [set, setSet] = useState(0);
  return (
    <Sticker cls="st-chart" d={0.9} bob={0.9} dx={320} dy={260} dr={18} label="Tương tác" onClick={() => setSet((i) => (i + 1) % BAR_SETS.length)}>
      <span className="st-chart-label">Tương tác</span>
      <span className="st-bars">
        {BAR_SETS[set].map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </span>
    </Sticker>
  );
}

function Spark({ which, d, bob, dx, dy, dr }) {
  const [shot, live, fire] = useShot();
  return (
    <Sticker
      cls={`st-spark st-spark-${which}`} d={d} bob={bob} dx={dx} dy={dy} dr={dr} label="Lấp lánh" onClick={fire}
      extra={<Burst shot={shot} live={live} n={10} dist={44} className="burst-sparks">✦</Burst>}
    >
      ✦
    </Sticker>
  );
}

export default function HeroStickers() {
  return (
    <div className="stickers" aria-hidden="true">
      <Likes />
      <Play />
      <Tag />
      <Comment />
      <Chart />
      <Share />
      <Spark which="a" d={2.2} bob={0.3} dx={-220} dy={-300} dr={90} />
      <Spark which="b" d={0.5} bob={1.5} dx={160} dy={320} dr={-90} />
    </div>
  );
}
