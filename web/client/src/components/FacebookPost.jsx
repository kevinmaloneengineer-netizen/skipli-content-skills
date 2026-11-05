import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthGate.jsx";
import FilePick from "./FilePick.jsx";
import PostPreview from "./PostPreview.jsx";
import { api } from "../lib/api.js";
import { crop, loadImage, upload } from "../lib/image.js";

/**
 * "Đăng Fanpage": a result's text (editable), an optional photo, now or at a time, to one of the
 * Facebook Pages this account connected. Mount it only while it is open.
 */
export default function FacebookPost({ text, jobId, onClose, onPosted }) {
  const { user } = useAuth();
  const pages = user?.fbPages ?? [];
  const ref = useRef(null);
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [message, setMessage] = useState(text);
  const [photo, setPhoto] = useState(null);
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  // The chosen photo as the phone shows it; the URL is let go when the photo changes or the dialog closes.
  const [photoUrl, setPhotoUrl] = useState(null);
  useEffect(() => {
    if (!photo) return setPhotoUrl(null);
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const page = pages.find((p) => p.id === pageId) ?? pages[0];

  async function post(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let photoId;
      if (photo) {
        const img = await loadImage(photo);
        photoId = await upload(crop(img, 0, 0, img.naturalWidth, img.naturalHeight, 2048));
      }
      const out = await api("/facebook/post", { method: "POST", body: { pageId, message, photoId, jobId, at: at ? new Date(at).toISOString() : undefined } });
      setDone(out);
      onPosted?.(out);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="confirm-dialog fb-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="confirm-body">
        <h3>Đăng lên Fanpage</h3>
        {!pages.length ? (
          <>
            <p>Bạn chưa kết nối Fanpage nào. Kết nối một lần ở trang Tài khoản, sau đó đăng thẳng từ mọi kết quả.</p>
            <div className="confirm-actions">
              <button type="button" className="btn small ghost" onClick={() => ref.current.close()}>Đóng</button>
              <Link className="btn small primary" to="/account#facebook">Kết nối Facebook</Link>
            </div>
          </>
        ) : done ? (
          <>
            <p className="fb-done">{done.scheduled ? `Đã hẹn giờ đăng lên ${done.pageName}.` : `Đã đăng lên ${done.pageName}.`}</p>
            <div className="confirm-actions">
              <button type="button" className="btn small ghost" onClick={() => ref.current.close()}>Đóng</button>
              <a className="btn small primary" href={done.url} target="_blank" rel="noopener noreferrer">Xem bài trên Facebook</a>
            </div>
          </>
        ) : (
          <form onSubmit={post} className="fb-compose">
            <div className="fb-compose-fields">
            {pages.length > 1 ? (
              <label className="field"><span className="field-label">Trang</span>
                <select value={pageId} onChange={(e) => setPageId(e.target.value)}>
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ) : (
              <p className="fb-page"><span className="fb-avatar" aria-hidden="true">f</span><b>{pages[0].name}</b></p>
            )}
            <label className="field"><span className="field-label">Nội dung (sửa được trước khi đăng)</span>
              <textarea rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <div className="field">
              <span className="field-label">Ảnh (tuỳ chọn)</span>
              <FilePick accept="image/png,image/jpeg,image/webp" file={photo} onChange={setPhoto} placeholder="Chọn ảnh từ máy" kind="image" disabled={busy} />
            </div>
            <label className="field"><span className="field-label">Hẹn giờ (tuỳ chọn, từ 15 phút tới 29 ngày tới)</span>
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            {/\[[A-ZĐ ]{2,}\]/.test(message) && <p className="fb-warn">Bài còn chỗ trống như [GIÁ], [LINK]. Điền vào trước khi đăng nhé.</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn small ghost" onClick={() => ref.current.close()}>Huỷ</button>
              <button className="btn small primary" disabled={busy || !message.trim()}>{busy ? "Đang đăng…" : at ? "Hẹn giờ đăng" : "Đăng ngay"}</button>
            </div>
            </div>
            <div className="fb-compose-preview">
              <span className="field-label">Xem trước trên điện thoại</span>
              <PostPreview name={page?.name ?? "Fanpage"} text={message} photo={photoUrl} fresh />
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
