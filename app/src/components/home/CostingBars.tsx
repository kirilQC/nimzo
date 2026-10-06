import { motifLabel } from "@/lib/taxonomy";
import type { PatternStat } from "@/lib/data";

/** The habits that cost you most often, as long gold bars out of your last N games. */
export function CostingBars({ stats, windowGames }: { stats: PatternStat[]; windowGames: number }) {
  return (
    <ol className="space-y-3" aria-label={`Most frequent mistake tags over your last ${windowGames} games`}>
      {stats.map((s) => (
        <li key={s.motif} className="grid grid-cols-1 items-center gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)_72px]">
          <span className="font-semibold text-ink">{motifLabel(s.motif)}</span>
          <span className="h-[22px] overflow-hidden rounded-[4px] bg-card" aria-hidden="true">
            <span className="block h-full bg-gradient-to-r from-[color:var(--gold-rule)] to-gold" style={{ width: `${Math.min(100, (s.games / windowGames) * 100)}%` }} />
          </span>
          <span className="font-[family-name:var(--font-poster)] text-[1.5rem] leading-none text-gold">
            {s.games}
            <span className="text-[0.9375rem] text-muted">/{windowGames}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
