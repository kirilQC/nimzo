import { motifLabel } from "@/lib/taxonomy";
import type { PatternStat } from "@/lib/data";

export function PatternBars({ stats, windowGames }: { stats: PatternStat[]; windowGames: number }) {
  const max = Math.max(1, ...stats.map((s) => s.games));
  return (
    <ul className="space-y-3" aria-label={`Most frequent mistake tags over your last ${windowGames} games`}>
      {stats.map((s) => (
        <li key={s.motif}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-ink">{motifLabel(s.motif)}</span>
            <span className="mono text-[0.8125rem] text-muted">
              {s.games} {s.games === 1 ? "game" : "games"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-chip" aria-hidden="true">
            <div className="h-full rounded-full bg-walnut" style={{ width: `${(s.games / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
