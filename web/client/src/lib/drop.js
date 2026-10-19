import { useRef, useState } from "react";

/** Does a file match an <input accept> list ("image/png,image/*,.mp3")? An empty list takes anything. */
export function accepts(file, accept = "") {
  const rules = String(accept).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
}

/**
 * Drag and drop onto a file picker. Spread `props` on the drop area; `over` is true while a file is held
 * over it. onFiles gets the dropped files that match `accept` (all of them with multiple, else the first);
 * onReject(message) when none do.
 */
export function useDrop({ accept, multiple = false, disabled = false, onFiles, onReject }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0); // dragenter / dragleave also fire for the children
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  const props = disabled
    ? {}
    : {
        onDragEnter(e) {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current += 1;
          setOver(true);
        },
        onDragOver(e) {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        },
        onDragLeave() {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        },
        onDrop(e) {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          const files = [...e.dataTransfer.files].filter((f) => accepts(f, accept));
          if (!files.length) return onReject?.("File này không đúng loại, hãy chọn file khác.");
          onFiles(multiple ? files : [files[0]]);
        },
      };
  return { over, props };
}
