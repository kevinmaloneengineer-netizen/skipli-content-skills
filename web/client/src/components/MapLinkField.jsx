import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

/** Where the video's pin will go, before the video is made (the map is not one of the photos to review). */
export function MapPreview({ link }) {
  const [state, setState] = useState({ status: "checking" });
  useEffect(() => {
    let live = true;
    api("/map/check", { method: "POST", body: { link } }).then(
      (spot) => live && setState({ status: "ok", spot }),
      (e) => live && setState({ status: "error", error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [link]);
  const { spot } = state;
  return (
    <div className="map-preview">
      <div>
        <b>Cảnh bản đồ</b>
        <p>Không phải ảnh để duyệt: bản đồ thật quanh quán được thêm vào video khi bấm Dựng video, ghim đặt đúng chỗ của link Google Maps.</p>
        {state.status === "checking" && <small>Đang đọc vị trí từ link…</small>}
        {state.status === "error" && <small className="map-link-err">{state.error} Video sẽ không có cảnh bản đồ.</small>}
      </div>
      {spot && <iframe title="Vị trí ghim" src={`https://maps.google.com/maps?q=${spot.lat},${spot.lon}&z=17&output=embed`} loading="lazy" referrerPolicy="no-referrer" />}
    </div>
  );
}

/**
 * The restaurant's Google Maps link for the "Chỉ đường" template, checked as soon as it is pasted: the
 * server reads the exact pin from it. onReady(true) only once the pin is read.
 */
export default function MapLinkField({ value, onChange, onReady }) {
  const [state, setState] = useState({ status: "idle" });
  useEffect(() => {
    const link = value.trim();
    onReady(false);
    if (!link) return setState({ status: "idle" });
    let live = true;
    setState({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const spot = await api("/map/check", { method: "POST", body: { link } });
        if (!live) return;
        setState({ status: "ok", spot });
        onReady(true);
      } catch (e) {
        if (live) setState({ status: "error", error: e.message });
      }
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const { spot } = state;
  return (
    <label className="field">
      <span className="field-label">Link Google Maps của quán (bắt buộc)</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://maps.app.goo.gl/…" autoComplete="off" maxLength={1000} required />
      {state.status === "idle" && <small>Mở quán trên Google Maps, bấm Chia sẻ rồi Sao chép đường liên kết và dán vào đây. Ghim trong video đặt đúng chỗ của link này.</small>}
      {state.status === "checking" && <small>Đang đọc vị trí từ link…</small>}
      {state.status === "ok" && (
        <small className="map-link-ok">
          Đã đọc được vị trí quán ({spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}).{" "}
          <a href={`https://www.google.com/maps?q=${spot.lat},${spot.lon}`} target="_blank" rel="noreferrer">Xem thử trên Google Maps</a>
        </small>
      )}
      {state.status === "error" && <small className="map-link-err">{state.error}</small>}
    </label>
  );
}
