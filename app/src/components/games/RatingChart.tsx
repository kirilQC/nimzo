"use client";

import { useMemo, useRef, useState } from "react";

export type RatingSeries = { id: string; label: string; color: string; points: { t: number; rating: number }[] };

const W = 900, H = 240, PAD = { l: 44, r: 12, t: 12, b: 26 };

/** Rating over time, one line per time control, with a hover readout. */
export function RatingChart({ series }: { series: RatingSeries[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ s: RatingSeries; p: { t: number; rating: number }; x: number; y: number } | null>(null);

  const { x, y, ticks, years } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
    const r0 = Math.min(...all.map((p) => p.rating)), r1 = Math.max(...all.map((p) => p.rating));
    const lo = Math.floor((r0 - 20) / 50) * 50, hi = Math.ceil((r1 + 20) / 50) * 50;
    const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (r: number) => PAD.t + (1 - (r - lo) / Math.max(1, hi - lo)) * (H - PAD.t - PAD.b);
    const step = (hi - lo) / 50 > 8 ? 100 : 50;
    const ticks: number[] = [];
    for (let r = lo; r <= hi; r += step) ticks.push(r);
    const years: { t: number; label: string }[] = [];
    for (let yr = new Date(t0).getFullYear() + 1; yr <= new Date(t1).getFullYear(); yr++) years.push({ t: Date.UTC(yr, 0, 1), label: String(yr) });
    return { x, y, ticks, years };
  }, [series]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * H;
    let best: typeof hover = null, dist = Infinity;
    for (const s of series)
      for (const p of s.points) {
        const px = x(p.t), py = y(p.rating);
        const d = (px - mx) ** 2 + ((py - my) / 3) ** 2;
        if (d < dist) {
          dist = d;
          best = { s, p, x: px, y: py };
        }
      }
    setHover(best);
  }

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Rating over time" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="var(--border-soft)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(r)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
              {r}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <g key={yr.label}>
            <line x1={x(yr.t)} x2={x(yr.t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border-soft)" strokeDasharray="3 3" />
            <text x={x(yr.t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {yr.label}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s.id} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" points={s.points.map((p) => `${x(p.t).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ")} />
        ))}
        {hover && <circle cx={hover.x} cy={hover.y} r="4.5" fill={hover.s.color} stroke="#fff" strokeWidth="1.5" />}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded-[6px] border border-line bg-card px-2 py-1 text-xs shadow-sm"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: "translate(-50%, -130%)" }}
        >
          <span className="mono font-semibold text-ink">{hover.p.rating}</span> <span className="text-muted">{hover.s.label}</span>
          <br />
          <span className="text-muted">{new Date(hover.p.t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      )}
    </div>
  );
}
