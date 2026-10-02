import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True while `ref` is on screen, the tab is visible and the user has not asked
 * for reduced motion. Gate every always-running animation on it so nothing
 * ticks in the background.
 */
export function useLive(ref) {
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return inView && visible && !reducedMotion();
}

/** setInterval that always calls the latest callback and stops when inactive. */
export function useInterval(callback, ms, active = true) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!active || ms == null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/**
 * Types each string in `lines` out, holds it, deletes it, then moves on.
 * Returns [text, index, isTyping]. When inactive it shows the current line in full.
 */
export function useTypewriter(lines, { active = true, typeMs = 42, eraseMs = 16, holdMs = 1700 } = {}) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(lines[0].length);
  const [phase, setPhase] = useState("hold"); // type | hold | erase

  useEffect(() => {
    if (!active) return;
    const line = lines[i];
    let t;
    if (phase === "type") {
      t = n < line.length ? setTimeout(() => setN(n + 1), typeMs) : setTimeout(() => setPhase("hold"), 0);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("erase"), holdMs);
    } else {
      t = n > 0 ? setTimeout(() => setN(n - 1), eraseMs) : setTimeout(() => {
        setI((i + 1) % lines.length);
        setPhase("type");
      }, 250);
    }
    return () => clearTimeout(t);
  }, [active, phase, n, i, lines, typeMs, eraseMs, holdMs]);

  return [active ? lines[i].slice(0, n) : lines[i], i, active && phase !== "hold"];
}

/** 12431 → "12.4K": the short form social apps use on counters. */
export function shortCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
