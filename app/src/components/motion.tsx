"use client";

import { useEffect, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that ticks up to its value when it first appears. Screen readers get the final value. */
export function CountUp({ to, decimals = 0, duration = 900, delay = 0 }: { to: number; decimals?: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced()) {
      const id = requestAnimationFrame(() => setShown(to));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setShown(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);
  return (
    <>
      <span aria-hidden="true">{shown.toFixed(decimals)}</span>
      <span className="sr-only">{to.toFixed(decimals)}</span>
    </>
  );
}

/** Soft shimmering lines while Arthur is writing. */
export function Shimmer({ lines = 3, label = "Arthur is thinking" }: { lines?: number; label?: string }) {
  const widths = ["94%", "82%", "58%", "70%"];
  return (
    <span className="block py-1" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="shimmer mb-2 block h-3 rounded-[6px]" style={{ width: widths[i % widths.length] }} />
      ))}
    </span>
  );
}
