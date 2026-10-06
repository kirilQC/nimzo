"use client";

import { useMemo, useRef, useState } from "react";
import { CountUp } from "@/components/motion";

export type RatedGame = { timeClass: string | null; end: string; myRating: number | null; result: "win" | "loss" | "draw"; accuracy?: number | null };

const MODES = [
  ["rapid", "Rapid"],
  ["blitz", "Blitz"],
  ["bullet", "Bullet"],
  ["daily", "Daily"],
] as const;
const W = 1000, H = 220, PAD = 8;
const DAY = 864e5;

const monthYear = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * One time control at a time: four metric cards (peak, last 30 days, last 30
 * games, record) above a quiet card with the tabs, the rating in large serif
 * figures and a thin line of its history. Hover the line for any day's rating.
 */
export function RatingJourney({ games, initial }: { games: RatedGame[]; initial?: string }) {
  const available = MODES.filter(([id]) => games.filter((g) => g.timeClass === id && g.myRating !== null).length > 1);
  const [mode, setMode] = useState<string>(available.some(([id]) => id === initial) ? initial! : (available[0]?.[0] ?? "rapid"));
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ t: number; rating: number; x: number; y: number } | null>(null);
  const [today] = useState(() => Date.now());

  const data = useMemo(() => {
    const list = games
      .filter((g) => g.timeClass === mode && g.myRating !== null)
      .map((g) => ({ t: Date.parse(g.end), rating: g.myRating!, result: g.result }))
      .sort((a, b) => a.t - b.t);
    if (list.length < 2) return null;
    const now = list.at(-1)!;
    const peak = list.reduce((a, b) => (b.rating > a.rating ? b : a));
    const monthAgo = today - 30 * DAY;
    const before30d = [...list].reverse().find((p) => p.t <= monthAgo)?.rating ?? list[0]!.rating;
    const last30 = list.slice(-30);
    const before30g = list.length > 30 ? list[list.length - 31]!.rating : list[0]!.rating;
    const wins = list.filter((p) => p.result === "win").length, losses = list.filter((p) => p.result === "loss").length;
    // Accuracy: the median is your typical game; the average is shown beside it.
    const accs = games.filter((g) => g.timeClass === mode && g.accuracy !== null && g.accuracy !== undefined).map((g) => g.accuracy!).sort((a, b) => a - b);
    const median = accs.length ? (accs.length % 2 ? accs[(accs.length - 1) / 2]! : (accs[accs.length / 2 - 1]! + accs[accs.length / 2]!) / 2) : null;
    const mean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
    const t0 = list[0]!.t, t1 = now.t;
    const lo = Math.min(...list.map((p) => p.rating)) - 20, hi = Math.max(...list.map((p) => p.rating)) + 20;
    const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = (r: number) => PAD + (1 - (r - lo) / Math.max(1, hi - lo)) * (H - 2 * PAD);
    return {
      list,
      now: now.rating,
      peak,
      d30: { change: now.rating - before30d, from: before30d },
      g30: { change: now.rating - before30g, wins: last30.filter((p) => p.result === "win").length, losses: last30.filter((p) => p.result === "loss").length },
      record: { wins, losses, games: list.length, pct: Math.round((wins / list.length) * 100) },
      accuracy: { median, mean, n: accs.length },
      start: t0,
      x,
      y,
      line: list.map((p) => `${x(p.t).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" "),
    };
  }, [games, mode, today]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!svg || !data) return;
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    let best = data.list[0]!;
    for (const p of data.list) if (Math.abs(data.x(p.t) - mx) < Math.abs(data.x(best.t) - mx)) best = p;
    setHover({ t: best.t, rating: best.rating, x: data.x(best.t), y: data.y(best.rating) });
  }

  if (!data) return <p className="card text-sm text-muted">Not enough rated games to draw a line.</p>;
  const up = (n: number) => (n >= 0 ? "text-good" : "text-[color:var(--loss)]");
  const arrow = (n: number) => (n >= 0 ? "▲" : "▼");

  return (
    <section aria-labelledby="rating-h" className="space-y-3.5">
      <h2 id="rating-h" className="sr-only">
        Rating
      </h2>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Metric label="Peak" sub={monthYear(data.peak.t)}>
          <CountUp to={data.peak.rating} />
        </Metric>
        <Metric label="Last 30 days" sub={`${data.d30.from} to ${data.now}`} className={up(data.d30.change)}>
          {arrow(data.d30.change)} <CountUp to={Math.abs(data.d30.change)} />
        </Metric>
        <Metric label="Last 30 games" sub={`${data.g30.wins} wins, ${data.g30.losses} losses`} className={up(data.g30.change)}>
          {arrow(data.g30.change)} <CountUp to={Math.abs(data.g30.change)} />
        </Metric>
        <Metric label="Record" sub={`${data.record.games.toLocaleString("en-US")} games · ${data.record.pct}% won`}>
          {data.record.wins}
          <span className="text-[0.55em] text-muted"> W </span>
          {data.record.losses}
          <span className="text-[0.55em] text-muted"> L</span>
        </Metric>
        <Metric label="Accuracy" sub={data.accuracy.mean !== null ? `typical game · average ${data.accuracy.mean.toFixed(1)}` : "no analyzed games yet"}>
          {data.accuracy.median !== null ? <CountUp to={data.accuracy.median} decimals={1} /> : "?"}
        </Metric>
      </div>

      <div className="card px-6 py-6 sm:px-8">
        <div role="tablist" aria-label="Time control" className="flex justify-center gap-6">
          {available.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => {
                setMode(id);
                setHover(null);
              }}
              className={`border-b-2 py-1 text-[0.9375rem] transition-colors ${mode === id ? "border-gold font-bold text-gold" : "border-transparent font-medium text-muted hover:text-ink"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center font-[family-name:var(--font-display)] text-[clamp(5rem,9vw,8.5rem)] leading-[0.95] text-ink" aria-label={`${mode} rating ${data.now}`}>
          <CountUp key={mode} to={data.now} />
        </p>
        <div className="relative mt-6">
          <svg
            key={mode}
            ref={ref}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="draw-in block h-[220px] w-full overflow-visible"
            role="img"
            aria-label={`${mode} rating over time, from ${data.list[0]!.rating} to ${data.now}`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <polyline points={data.line} fill="none" stroke="var(--brass)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {hover && <line x1={hover.x} x2={hover.x} y1="0" y2={H} stroke="var(--ink)" strokeOpacity="0.3" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold" style={{ left: "100%", top: `${(data.y(data.now) / H) * 100}%` }} aria-hidden="true" />
          {hover && (
            <>
              <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--card)] bg-gold" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }} />
              <div
                className="pointer-events-none absolute rounded-[8px] border border-line bg-[#0b1f17] px-2.5 py-1.5 text-center shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
                style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: "translate(-50%, -135%)" }}
              >
                <span className="mono block text-[1.0625rem] text-ink">{hover.rating}</span>
                <span className="text-[0.75rem] text-muted">{new Date(hover.t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </>
          )}
        </div>
        <p className="label-data mt-2 flex justify-between">
          <span>{monthYear(data.start)}</span>
          <span>Today</span>
        </p>
      </div>
    </section>
  );
}

function Metric({ label, sub, className = "text-ink", children }: { label: string; sub: string; className?: string; children: React.ReactNode }) {
  return (
    <div className="card lift px-5 py-4">
      <p className="label-data">{label}</p>
      <p className={`mt-1.5 font-[family-name:var(--font-poster)] text-[2.5rem] leading-none ${className}`}>{children}</p>
      <p className="mt-1.5 text-[0.8125rem] text-muted">{sub}</p>
    </div>
  );
}
