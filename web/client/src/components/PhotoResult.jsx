import { useState } from "react";

const RATIO_NAME = { "1:1": "Vuông 1:1", "4:5": "Dọc 4:5", "9:16": "Dọc 9:16", "16:9": "Ngang 16:9" };

/** "Chỉnh ảnh món" result: a before / after slider on the photo's own frame, then each frame to download. */
export default function PhotoResult({ job }) {
  const { original, fixed, width, height, items } = job.photos;
  const [at, setAt] = useState(50); // % of the photo shown "after"
  const name = (job.input?.label || "mon-an").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "mon-an";

  return (
    <div className="pf-result">
      {fixed && (
        <figure className="pf-compare" style={{ aspectRatio: `${width} / ${height}` }}>
          <img src={`/media/images/${fixed}`} alt="Sau khi chỉnh" />
          <div className="pf-before" style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }}>
            <img src={`/media/images/${original}`} alt="Ảnh gốc" />
          </div>
          <span className="pf-tag is-before">Trước</span>
          <span className="pf-tag is-after">{job.photos.ai && job.photos.ai !== "off" ? "Sau · AI làm đẹp" : job.photos.background && job.photos.background !== "original" ? "Sau · nền mới" : "Sau"}</span>
          <span className="pf-handle" style={{ left: `${at}%` }} aria-hidden="true" />
          <input type="range" min="0" max="100" value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="Kéo để so sánh trước và sau" />
        </figure>
      )}
      <div className="pf-downloads">
        {items.map((x) => (
          <figure key={x.file} className="pf-out">
            <img src={`/media/images/${x.file}`} alt={RATIO_NAME[x.ratio] ?? x.ratio} style={{ aspectRatio: `${x.width} / ${x.height}` }} loading="lazy" />
            <figcaption>
              <span><b>{RATIO_NAME[x.ratio] ?? x.ratio}</b><small>{x.width}×{x.height}</small></span>
              <a className="btn small primary" href={`/media/images/${x.file}`} download={`${name}-${x.ratio.replace(":", "x")}.jpg`}>Tải về</a>
            </figcaption>
          </figure>
        ))}
        {fixed && (
          <figure className="pf-out">
            <img src={`/media/images/${fixed}`} alt="Khung gốc" style={{ aspectRatio: `${width} / ${height}` }} loading="lazy" />
            <figcaption>
              <span><b>Khung gốc</b><small>{width}×{height}</small></span>
              <a className="btn small" href={`/media/images/${fixed}`} download={`${name}-goc.jpg`}>Tải về</a>
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}
