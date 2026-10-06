"use client";

import { useRef } from "react";
import type { Severity } from "@/components/ui";

export type GraphPoint = { ply: number; whitePct: number | null; severity?: Severity | null; isMine?: boolean };

const W = 600;
const H = 120;
const MARKER_COLOR: Record<Severity, string> = { blunder: "#FA412D", miss: "#FF7769", mistake: "#FFA459", inaccuracy: "#F7C631" };

/**
 * Win% across the game (White's perspective, 50% = level). Click anywhere to
 * jump to that move; each flagged move also gets its own focusable marker.
 */
export function EvalGraph({
  points,
  current,
  onSelect,
}: {
  points: GraphPoint[];
  current: number;
  onSelect: (ply: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const n = Math.max(points.length, 1);
  const x = (ply: number) => (n <= 1 ? 0 : ((ply - 1) / (n - 1)) * W);
  const y = (pct: number) => H - (pct / 100) * H;
  const analyzed = points.some((p) => p.whitePct !== null);

  if (!analyzed) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-[8px] border border-dashed border-line text-sm text-muted">
        The evaluation graph appears once the engine has analyzed this game.
      </div>
    );
  }

  const line = points
    .filter((p) => p.whitePct !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ply).toFixed(1)},${y(p.whitePct!).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = (e.clientX - rect.left) / rect.width;
    onSelect(Math.min(n, Math.max(1, Math.round(rel * (n - 1)) + 1)));
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="draw-in block h-[120px] w-full cursor-pointer"
        onClick={handleClick}
        aria-label="Evaluation graph. Click to jump to a move."
        role="img"
      >
        <path d={area} fill="#E3C35A" opacity="0.14" />
        <path d={line} fill="none" stroke="#E3C35A" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#2C4C3C" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {current > 0 && (
          <line x1={x(current)} x2={x(current)} y1="0" y2={H} stroke="#EFE6CC" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {points
        .filter((p) => p.severity && p.isMine && p.whitePct !== null)
        .map((p) => (
          <button
            key={p.ply}
            type="button"
            onClick={() => onSelect(p.ply)}
            aria-label={`Jump to ${p.severity} at ply ${p.ply}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#132e23] shadow-[0_0_0_1px_#2c4c3c]"
            style={{
              left: `${(x(p.ply) / W) * 100}%`,
              top: `${(y(p.whitePct!) / H) * 100}%`,
              width: 12,
              height: 12,
              background: MARKER_COLOR[p.severity!],
            }}
          />
        ))}
    </div>
  );
}
