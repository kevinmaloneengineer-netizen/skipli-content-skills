import { useState } from "react";

/** Plausible preview numbers, stable per post (seeded by the text, so they don't jump while typing a little). */
function fakeStats(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = (n) => ((h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0) % n);
  const likes = 180 + r(2400);
  return { likes, comments: Math.round(likes * (0.04 + r(9) / 100)), shares: Math.round(likes * (0.01 + r(5) / 100)) };
}
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));

const Like = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#1877f2" /><path d="M4.5 7.2h1.6v4.3H4.5zM6.8 11.5V7.3l1.9-2.6c.3-.4 1-.2 1 .3v1.6h1.6c.6 0 1 .5.9 1.1l-.5 2.6c-.1.7-.7 1.2-1.4 1.2z" fill="#fff" /></svg>
);
const Love = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#f33e58" /><path d="M8 11.8S4.3 9.6 4.3 7.1A1.9 1.9 0 0 1 8 6.2a1.9 1.9 0 0 1 3.7.9c0 2.5-3.7 4.7-3.7 4.7z" fill="#fff" /></svg>
);
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);

/** Post as it looks in the Facebook phone app: long text is cut after ~6 lines with "Xem thêm". */
export default function PostPreview({ name, text, photo = null, fresh = false }) {
  const [more, setMore] = useState(false);
  const long = text.length > 280 || text.split("\n").length > 6;
  const shown = !long || more ? text : `${text.slice(0, 260).replace(/\s+\S*$/, "")}…`;
  const now = new Date();
  const st = fakeStats(name + text.slice(0, 40));
  return (
    <div className="cb-phone" aria-label="Xem trước trên điện thoại">
      <div className="cb-phone-screen">
        <div className="cb-phone-status">
          <b>{`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`}</b>
          <span className="cb-phone-notch" />
          <span className="cb-phone-icons"><i /><i /><i /></span>
        </div>
        <div className="cb-fb-bar">
          <b>facebook</b>
          <span><i /><i /></span>
        </div>
        <div className="cb-fb-feed">
          <article className="cb-fb-post">
            <div className="cb-preview-head">
              <span className="cb-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
              <span>
                <b>{name}</b>
                <small>Vừa xong · 🌐</small>
              </span>
              <em className="cb-fb-dots">···</em>
            </div>
            <p className="cb-preview-text">
              {text ? shown : "Bài viết trống"}
              {long && !more && <button type="button" className="cb-more" onClick={() => setMore(true)}> Xem thêm</button>}
            </p>
            {photo && <img className="cb-fb-photo" src={photo} alt="" />}
            {!fresh && <div className="cb-fb-counts">
              <span className="cb-reacts"><Like /><Love />{fmt(st.likes)}</span>
              <span>{fmt(st.comments)} bình luận · {fmt(st.shares)} lượt chia sẻ</span>
            </div>}
            <div className="cb-preview-actions" aria-hidden="true">
              <span><Icon d="M7 10v10H4V10zM7 10l4-7c1.2 0 2 .9 2 2v3h5.5c1 0 1.7.9 1.5 1.9l-1.3 6.8c-.2.8-.9 1.3-1.7 1.3H7" />Thích</span>
              <span><Icon d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-3.9A8 8 0 1 1 20 11.5z" />Bình luận</span>
              <span><Icon d="M14 5l7 6.5-7 6.5v-4c-5 0-8 1.5-10 5 .7-5.5 3.5-9.5 10-10z" />Chia sẻ</span>
            </div>
          </article>
          <div className="cb-fb-ghost" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
}
