import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import { splitVariants } from "./text.js";

/**
 * "Làm tiếp với…": a tool opened with ?from=<job id> fills its form from that finished run.
 * useFromJob() returns the run (or null), loaded once.
 */
export function useFromJob() {
  const [params] = useSearchParams();
  const id = params.get("from");
  const [job, setJob] = useState(null);
  useEffect(() => {
    if (!id) return;
    api(`/jobs/${id}`).then(({ job: j }) => j?.status === "done" && setJob(j), () => {});
  }, [id]);
  return job;
}

/** The variant prefix each writing tool uses in its result ("## Phương án 1: …", "## Bài 1: …"). */
const PREFIX = { write: "Phương án", "gbp-post": "Bài", menu: "Món", inbox: "Tình huống", hashtag: "Bộ", review: "Phương án" };

/** The first post of a writing result, without its heading and the notes under it. */
export function firstPost(job) {
  const { variants } = splitVariants(job?.result ?? "", PREFIX[job?.type] ?? "Phương án");
  const body = variants[0]?.body ?? String(job?.result ?? "").replace(/^## .*$/gm, "").trim();
  return body.replace(/^\*\*(Nút|Ảnh nên dùng):\*\*.*$/gm, "").trim().slice(0, 1800);
}

/** A "## Heading" section of a report. */
export function section(md, name) {
  const part = String(md ?? "").split(/^(?=## )/m).find((p) => p.toLowerCase().startsWith(`## ${name.toLowerCase()}`));
  return part ? part.split("\n").slice(1).join("\n").trim() : "";
}

/** Table rows / bullets of a section → short lines ("Nước lẩu đậm đà (24 lượt nhắc)"). */
export function points(text, max = 5) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const row = line.match(/^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/);
    if (row && !/điểm|số bài/i.test(row[1])) out.push(`${row[1]} (${row[2]} lượt nhắc)`);
    else if (/^[-*]\s+/.test(line)) out.push(line.replace(/^[-*]\s+/, "").trim());
  }
  return out.slice(0, max);
}

/** The restaurant a run was about (as typed in its form). */
export const businessOf = (job) => job?.input?.business || job?.input?.name || (job?.input?.place && !/^https?:/i.test(job.input.place) ? job.input.place : "") || "";

/** A picture the app made, as a File (for the photo pickers). */
export async function fileFromImage(file, name = "anh-mon.jpg") {
  const res = await fetch(`/media/images/${file}`);
  if (!res.ok) throw new Error("Không lấy được ảnh từ kết quả trước");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** The same picture as a data URL (the slideshow keeps its photos that way). */
export async function dataUrlFromImage(file) {
  const blob = await (await fileFromImage(file)).arrayBuffer();
  const b64 = btoa(new Uint8Array(blob).reduce((s, b) => s + String.fromCharCode(b), ""));
  return `data:image/jpeg;base64,${b64}`;
}
