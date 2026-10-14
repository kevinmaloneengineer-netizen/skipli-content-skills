import { useEffect, useMemo } from "react";

const ICONS = {
  video: <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" />,
  audio: <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />,
  image: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01" />,
};

/**
 * A drop-style file picker. Once a file is chosen it turns into a card that shows the file (icon, name,
 * size), a × to remove it, and for audio a player to listen before sending.
 */
export default function FilePick({ accept, file, onChange, placeholder, kind = "video", disabled = false, clearLabel = "Bỏ file này" }) {
  const url = useMemo(() => (file && kind === "audio" ? URL.createObjectURL(file) : null), [file, kind]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  if (file) {
    return (
      <div className="file-pick has-file">
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
    <label className="file-pick">
      <input type="file" accept={accept} disabled={disabled} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <span>{placeholder}</span>
    </label>
  );
}
