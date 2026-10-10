import { useCallback, useState } from "react";

/**
 * Per-job edits kept in this browser: { fills: { "GIÁ": "89k" }, variants: { 0: "rewritten…" } }.
 * The stored result stays as the AI wrote it; the page shows (and copies) the edited text.
 */
export function useJobEdits(jobId) {
  const key = `job-edits:${jobId}`;
  const [state, setState] = useState(() => ({ key, edits: load(key) }));
  const edits = state.key === key ? state.edits : load(key); // the job page is reused when its id changes
  const setEdits = useCallback(
    (change) =>
      setState((s) => {
        const current = s.key === key ? s.edits : load(key);
        const next = typeof change === "function" ? change(current) : change;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // storage blocked: edits just won't survive a reload
        }
        return { key, edits: next };
      }),
    [key],
  );
  return [edits, setEdits];
}

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

// [GIÁ], [ƯU ĐÃI], [LINK], [SĐT]…: upper-case words in brackets, not a markdown link "[x](url)".
const BLANK = /\[(\p{Lu}[\p{Lu}\d _/]{0,30})\](?!\()/gu;

/** Distinct placeholders in a text, in order of first use, with how often each appears. */
export function blanksOf(text) {
  const seen = new Map();
  for (const m of String(text ?? "").matchAll(BLANK)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  return [...seen].map(([name, count]) => ({ name, count }));
}

/** Replace the placeholders the user filled in; empty ones stay as they are. */
export const fillBlanks = (text, fills = {}) => String(text ?? "").replace(BLANK, (all, name) => (fills[name]?.trim() ? fills[name].trim() : all));
