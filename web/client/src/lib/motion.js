import { useEffect } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Drives the scroll-parallax layers with one CSS variable on <html>:
 *   --sy  scroll offset in px
 * Layers multiply it by their own depth (--d) in CSS, so one rAF write per
 * frame moves everything - no React re-renders. Deliberately no pointer
 * tracking: moving the mouse should only affect the element under it.
 */
export function useParallax() {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      frame = 0;
      root.style.setProperty("--sy", String(window.scrollY));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, []);
}

/** Narrow screens and reduced motion get a plain, static layout (matches the CSS fallback). */
export const STATIC_QUERY = "(max-width: 820px), (prefers-reduced-motion: reduce)";

/**
 * Scroll-driven scenes ("scrollytelling"). Every `.scene` under `ref` gets
 *   --p = 0..1  how far the page has scrolled through it while its `.stage` is pinned
 *   --e = 0..1  how far it has entered: 0 = its top at the viewport bottom, 1 = pinned
 * and every `.skill-card` in a `.track` gets
 *   --c = -1..1 its centre relative to the viewport centre (coverflow), --ac = |--c|.
 * CSS turns these into motion.
 *
 * A scene with a `.track` (horizontal card row) is made tall enough that the
 * vertical scroll maps 1:1 onto the track's horizontal overflow (--ox px),
 * plus `data-lead` viewport-heights of extra hold for the intro.
 */
export function useScenes(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scenes = [...root.querySelectorAll(".scene")];
    const mq = window.matchMedia(STATIC_QUERY);
    let frame = 0;

    const html = document.documentElement;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      let underBar = false;
      for (const s of scenes) {
        const r = s.getBoundingClientRect();
        const len = r.height - vh;
        const p = len > 0 ? Math.min(1, Math.max(0, -r.top / len)) : r.top < 0 ? 1 : 0;
        const e = Math.min(1, Math.max(0, 1 - r.top / vh));
        s.style.setProperty("--p", p.toFixed(4));
        s.style.setProperty("--e", e.toFixed(4));
        if (r.bottom > 0 && r.top < vh && !mq.matches) {
          const half = window.innerWidth / 2;
          for (const card of s.querySelectorAll(".track .skill-card")) {
            const b = card.getBoundingClientRect();
            const c = Math.max(-1, Math.min(1, (b.left + b.width / 2 - half) / half));
            card.style.setProperty("--c", c.toFixed(3));
            card.style.setProperty("--ac", Math.abs(c).toFixed(3));
          }
        }
        // Is a dark scene sitting under the 68px top bar? Then the bar goes dark too.
        if (s.dataset.dark !== undefined && r.top <= 34 && r.bottom > 34) underBar = true;
      }
      if (underBar) html.dataset.onDark = "";
      else delete html.dataset.onDark;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      const vh = window.innerHeight;
      for (const s of scenes) {
        const track = s.querySelector(".track");
        if (!track) continue;
        if (mq.matches) {
          s.style.removeProperty("height");
          s.style.removeProperty("--ox");
          continue;
        }
        const stage = s.querySelector(".stage");
        const ox = Math.max(0, track.scrollWidth - stage.clientWidth);
        const lead = Number(s.dataset.lead ?? 0.5);
        s.style.setProperty("--ox", String(ox));
        s.style.height = `${Math.round(vh * (1 + lead) + ox)}px`;
      }
      update();
    };

    measure();
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    scenes.forEach((s) => s.querySelector(".track") && ro.observe(s.querySelector(".track")));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    mq.addEventListener("change", measure);
    return () => {
      cancelAnimationFrame(frame);
      delete html.dataset.onDark;
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, [ref]);
}

/** Pointer handlers for a subtle 3D tilt + sheen (sets --rx/--ry/--px/--py on the element). */
export const tilt = {
  onPointerMove(e) {
    if (e.pointerType === "touch" || reducedMotion()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 7).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 6).toFixed(2)}deg`);
    el.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
  },
  onPointerLeave(e) {
    const el = e.currentTarget;
    for (const p of ["--rx", "--ry", "--px", "--py"]) el.style.removeProperty(p);
  },
};
