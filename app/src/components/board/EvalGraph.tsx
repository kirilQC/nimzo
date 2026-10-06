"use client";

import { useId, useRef } from "react";
import { MoveIcon } from "./MoveIcon";
import type { LabelId } from "@/lib/analysis/labels";
import type { PhaseSegment } from "@/lib/analysis/phases";

export type GraphPoint = { ply: number; myPct: number | null; label: LabelId | null; isMine: boolean };

const W = 600;
const H = 150;
const SHOWN: LabelId[] = ["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"];

/**
 * Your winning chances across the game: gold fills up from the bottom when you're
 * better, dark green is theirs. The game is split into its parts (opening,
 * middlegame, endgame) with a line about each above. Click anywhere to jump to that
 * move; your flagged moves sit on the line as their label icons.
 */
export function EvalGraph({
  points,
  segments,
  current,
  onSelect,
}: {
  points: GraphPoint[];
  segments: PhaseSegment[];
  current: number;
  onSelect: (ply: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/:/g, "");
  const n = Math.max(points.length, 1);
  const x = (ply: number) => (n <= 1 ? 0 : ((ply - 1) / (n - 1)) * W);
  const y = (pct: number) => H - (pct / 100) * H;
  const edge = (ply: number) => Math.min(W, Math.max(0, x(ply) - W / (2 * Math.max(n - 1, 1)))); // halfway between two plies
  const analyzed = points.some((p) => p.myPct !== null);

  if (!analyzed) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-[8px] border border-dashed border-line text-sm text-muted">
        The graph appears once the engine has analyzed this game.
      </div>
    );
  }

  const known = points.filter((p) => p.myPct !== null);
  const line = known.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ply).toFixed(1)},${y(p.myPct!).toFixed(1)}`).join(" ");
  const area = `${line} L${x(known.at(-1)!.ply).toFixed(1)},${H} L${x(known[0]!.ply).toFixed(1)},${H} Z`;
  const flagged = points.filter((p) => p.isMine && p.myPct !== null && p.label && SHOWN.includes(p.label));
  const lastMove = Math.ceil(n / 2);
  const ticks = Array.from({ length: Math.floor(lastMove / 5) }, (_, i) => (i + 1) * 5).filter((m) => m * 2 - 1 <= n);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = (e.clientX - rect.left) / rect.width;
    onSelect(Math.min(n, Math.max(1, Math.round(rel * (n - 1)) + 1)));
  }

  return (
    <div>
      {segments.length > 1 && (
        <ol className="mb-3 flex" aria-label="The game in parts">
          {segments.map((s) => {
            const width = ((edge(s.toPly + 1) || W) - edge(s.fromPly)) / W;
            return (
              <li key={s.phase} className="min-w-0 border-l border-line px-3 first:border-l-0 first:pl-0" style={{ flexBasis: `${width * 100}%`, flexGrow: 0, flexShrink: 1 }}>
                <p className="label-data text-gold">{s.title}</p>
                <p className="text-[0.8125rem] text-muted">
                  Moves {s.fromMove} to {s.toMove}
                </p>
                {s.story && <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-ink">{s.story}</p>}
              </li>
            );
          })}
        </ol>
      )}

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="draw-in block h-[170px] w-full cursor-pointer overflow-hidden rounded-[10px] bg-[#0b1f17]"
          onClick={handleClick}
          aria-label="Your winning chances through the game. Click to jump to a move."
          role="img"
        >
          <defs>
            <linearGradient id={`gold-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E3C35A" stopOpacity="0.95" />
              <stop offset="1" stopColor="#B8962F" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          {segments.map((s, i) =>
            i % 2 === 1 ? <rect key={s.phase} x={edge(s.fromPly)} y="0" width={(edge(s.toPly + 1) || W) - edge(s.fromPly)} height={H} fill="rgba(255,255,255,0.03)" /> : null,
          )}
          <path d={area} fill={`url(#gold-${gid})`} />
          <path d={line} fill="none" stroke="#F0D47A" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#0D241B" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          {segments.slice(1).map((s) => (
            <line key={s.phase} x1={edge(s.fromPly)} x2={edge(s.fromPly)} y1="0" y2={H} stroke="#EFE6CC" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          ))}
          {current > 0 && <line x1={x(current)} x2={x(current)} y1="0" y2={H} stroke="#EFE6CC" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        <span className="label-data pointer-events-none absolute left-3 top-2 text-[0.6875rem] text-muted">They are better</span>
        <span className="label-data pointer-events-none absolute bottom-2 left-3 text-[0.6875rem] text-[#5c4a14]">You are better</span>
        {flagged.map((p) => (
          <button
            key={p.ply}
            type="button"
            onClick={() => onSelect(p.ply)}
            aria-label={`Jump to your ${p.label} on move ${Math.ceil(p.ply / 2)}`}
            className="badge-pop absolute -translate-x-1/2 -translate-y-1/2 rounded-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] transition-transform hover:scale-125"
            style={{ left: `${(x(p.ply) / W) * 100}%`, top: `${(y(p.myPct!) / H) * 100}%` }}
          >
            <MoveIcon label={p.label!} size={20} />
          </button>
        ))}
      </div>

      <div className="relative mt-1 h-4" aria-hidden="true">
        {ticks.map((m) => (
          <span key={m} className="mono absolute -translate-x-1/2 text-[0.6875rem] text-muted" style={{ left: `${(x(m * 2 - 1) / W) * 100}%` }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
