"use client";

import Link from "next/link";
import { useId } from "react";
import { SeverityChip, type Severity } from "@/components/ui";

export type SessionGame = {
  id: string;
  opponent: string;
  result: "Win" | "Loss" | "Draw";
  timeControl: string;
  flags: { severity: Severity; count: number }[];
  status: string; // "Syncing" | "Analyzing" | "Analyzed · 2 min ago"
};

/**
 * Session mode card. Phase 1: layout only. The toggle is wired to sync and
 * polling in Phase 2, so it's disabled here rather than pretending to run.
 */
export function SessionCard({ on = false, games = [] }: { on?: boolean; games?: SessionGame[] }) {
  const labelId = useId();
  return (
    <section className="card p-6" aria-labelledby={labelId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={labelId} className="text-[1.75rem] leading-tight">
            Session mode
          </h2>
          <p className="mt-1 text-[0.9375rem] text-body2">
            {on ? "On · checking chess.com every 60 seconds for finished games" : "Off · nothing is running."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          className="toggle"
          disabled
          title="Connected in Phase 2"
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled>
          Analyze my last game
        </button>
        <button type="button" className="btn btn-secondary" disabled>
          End session &amp; summarize
        </button>
      </div>

      {on && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="eyebrow mb-2">This session</p>
          {games.length === 0 ? (
            <p className="text-sm text-muted">Waiting for your first finished game…</p>
          ) : (
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-ink">
                    vs {g.opponent} · {g.result} · {g.timeControl}
                  </span>
                  {g.flags.map((f) => (
                    <SeverityChip key={f.severity} severity={f.severity} count={f.count}/>
                  ))}
                  <span className="text-muted">{g.status}</span>
                  <Link href={`/games/${g.id}`} className="arrow-link">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
