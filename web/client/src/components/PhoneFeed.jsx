import { useState } from "react";
import { shortCount, useInterval } from "../lib/live.js";

// Phone mock-up for the opening scene: a social feed that keeps scrolling on a
// loop while counters tick up. Generic placeholder accounts - no real people or brands.

const POSTS = [
  { tone: "coral", name: "Shop của bạn", time: "2 giờ", text: "3 lỗi khiến fanpage mãi không ra đơn 👇", likes: 12400, comments: 328, shares: 506, dur: 48, viral: true },
  { tone: "green", name: "Đối thủ A", time: "5 giờ", text: "Review thật sau 30 ngày dùng thử: có đáng tiền?", likes: 8100, comments: 214, shares: 190, dur: 72 },
  { tone: "mustard", name: "Đối thủ B", time: "1 ngày", text: "Mẹo chụp ảnh sản phẩm đẹp chỉ bằng điện thoại", likes: 3900, comments: 97, shares: 88, dur: 35 },
  { tone: "plum", name: "Shop của bạn", time: "1 ngày", text: "Livestream tối nay 8h, săn deal cùng shop nha!", likes: 21000, comments: 1200, shares: 740, dur: 59, viral: true },
  { tone: "blue", name: "Đối thủ C", time: "2 ngày", text: "Hỏi thật: bạn chọn COD hay chuyển khoản trước?", likes: 5600, comments: 2100, shares: 64, dur: 22 },
];

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Post({ p, stats, bumped }) {
  return (
    <div className="post" data-tone={p.tone}>
      <div className="post-head">
        <span className="post-avatar" />
        <span className="post-who">
          <b>{p.name}</b>
          <small>{p.time} · 🌐</small>
        </span>
        {p.viral && <span className="post-hot">🔥 Viral</span>}
      </div>
      <p className="post-text">{p.text}</p>
      <div className="post-media" style={{ "--dur": `${p.dur}s` }}>
        <span className="post-shape a" />
        <span className="post-shape b" />
        <span className="post-play" />
        <span className="post-dur">{mmss(p.dur)}</span>
        <span className="post-progress" />
      </div>
      <div className="post-actions">
        <span key={`l${stats.likes}`} className={bumped ? "bump" : undefined}>♥ {shortCount(stats.likes)}</span>
        <span key={`c${stats.comments}`} className={bumped ? "bump" : undefined}>💬 {shortCount(stats.comments)}</span>
        <span>↗ {shortCount(stats.shares)}</span>
      </div>
    </div>
  );
}

export default function PhoneFeed({ live }) {
  const [stats, setStats] = useState(() => POSTS.map(({ likes, comments, shares }) => ({ likes, comments, shares })));
  const [bumped, setBumped] = useState(-1);

  // Every tick one post gets a burst of reactions, like a real feed.
  useInterval(
    () => {
      const i = Math.floor(Math.random() * POSTS.length);
      setStats((all) =>
        all.map((s, k) =>
          k === i
            ? { likes: s.likes + 60 + Math.floor(Math.random() * 240), comments: s.comments + Math.floor(Math.random() * 12), shares: s.shares + Math.floor(Math.random() * 4) }
            : s,
        ),
      );
      setBumped(i);
    },
    1300,
    live,
  );

  // The list is rendered twice so the loop scroll (-50%) is seamless.
  return (
    <div className="phone" data-live={live ? "" : undefined} aria-hidden="true">
      <div className="phone-screen">
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-notch" />
          <span className="phone-icons">
            <i /><i /><i />
          </span>
        </div>
        <div className="phone-appbar">
          <strong>Bảng tin</strong>
          <span className="phone-tabs">
            <em className="on">Dành cho bạn</em>
            <em>Đang theo dõi</em>
          </span>
        </div>
        <div className="feed-window">
          <div className="feed">
            {[0, 1].map((copy) =>
              POSTS.map((p, i) => <Post key={`${copy}-${i}`} p={p} stats={stats[i]} bumped={bumped === i} />),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
