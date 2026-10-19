import { useEffect, useMemo, useState } from "react";
import { useDrop } from "../lib/drop.js";

const ICONS = {
  video: <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" />,
  audio: <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />,
  image: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01" />,
};

/**
 * A drop-style file picker: click to choose, or drag a file onto it. Once a file is chosen it turns into a
 * card that shows the file (icon, name, size), a × to remove it, and for audio a player to listen before
 * sending; dropping another file on the card replaces it.
 */
export default function FilePick({ accept, file, onChange, placeholder, kind = "video", disabled = false, clearLabel = "Bỏ file này" }) {
  const url = useMemo(() => (file && kind === "audio" ? URL.createObjectURL(file) : null), [file, kind]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const [wrong, setWrong] = useState("");
  const { over, props } = useDrop({ accept, disabled, onFiles: ([f]) => { setWrong(""); onChange(f); }, onReject: setWrong });
  const cls = (base) => [base, over && "is-over"].filter(Boolean).join(" ");

  if (file) {
    return (
      <div className={cls("file-pick has-file")} {...props}>
        <span className="file-icon" aria-hidden="true"><svg viewBox="0 0 24 24">{ICONS[kind] ?? ICONS.video}</svg></span>
        <span className="file-meta">
          <b>{file.name}</b>
          <small>{(file.size / 1048576).toFixed(1)} MB · đã chọn</small>
        </span>
        <button type="button" className="file-clear" onClick={() => onChange(null)} disabled={disabled} aria-label={clearLabel} title={clearLabel}>×</button>
        {url && <audio className="file-audio" controls src={url} preload="metadata" />}
      </div>
    );
  }
  return (
    <label className={cls("file-pick")} {...props}>
      <input type="file" accept={accept} disabled={disabled} onChange={(e) => { setWrong(""); onChange(e.target.files?.[0] ?? null); }} />
      <span>{over ? "Thả file vào đây" : placeholder}</span>
      <small className="file-drop-hint">{wrong || "hoặc kéo thả file vào ô này"}</small>
    </label>
  );
}
