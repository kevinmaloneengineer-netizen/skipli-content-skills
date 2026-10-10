import { useEffect, useState } from "react";

const still = () => typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 to `target` once (ease-out), for scorecard numbers. Keeps the decimals of the target. */
export function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(() => (still() ? target : 0));
  useEffect(() => {
    if (still() || !Number.isFinite(target)) return setValue(target);
    let raf;
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms);
      setValue(target * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Number shown counting up; `decimals` and Vietnamese separators like "4,3" or "1.234". */
export function CountUp({ value, decimals = 0, suffix = "" }) {
  const v = useCountUp(Number(value) || 0);
  return <>{v.toLocaleString("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}
