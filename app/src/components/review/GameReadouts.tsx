import type { ReactNode } from "react";
import { Avatar, Flag, type PlayerLook } from "@/components/PlayerBadge";
import { ReanalyzeButton } from "./ReanalyzeButton";
import { CountUp } from "@/components/motion";

export type Readouts = {
  gameId: string | null;
  opponent: { name: string; rating: number | null; look?: PlayerLook; color: string } | null;
  me: { rating: number | null; color: string } | null;
  result: { text: string; tone: "win" | "loss" | "draw" } | null;
  game: { main: string; sub: string };
  accuracy: { mine: number | null; theirs: number | null; chesscom: number | null };
  fallbackTitle?: string;
};

function countryName(code: string | null | undefined): string | null {
  if (!code || !/^[A-Z]{2}$/.test(code) || code.startsWith("X")) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null;
  } catch {
    return null;
  }
}

function Tile({ label, children, className = "" }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`panel-data lift min-w-0 px-4 py-3 ${className}`}>
      {label && <p className="label-data">{label}</p>}
      {children}
    </div>
  );
}

const TONE = { win: "text-good", loss: "text-[color:var(--loss)]", draw: "text-ink" } as const;

/** Instrument style row across the top of a game: who you played, how it ended, the game, accuracy, reanalyze. */
export function GameReadouts({ r }: { r: Readouts }) {
  const opp = r.opponent;
  const country = countryName(opp?.look?.country_code);
  const pct = r.accuracy.mine ?? 0;
  const circ = 2 * Math.PI * 24;
  return (
    <section aria-label="Game" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.3fr_1fr_1fr]">
      <Tile className="flex items-center gap-3">
        {opp ? (
          <>
            <Avatar src={opp.look?.avatar_url} name={opp.name} size={52} />
            <div className="min-w-0">
              <p className="label-data">Opponent</p>
              <p className="mono flex items-center gap-2 text-[1.375rem] leading-tight text-ink">
                {opp.look?.title && <span className="rounded-[3px] bg-[#7c2d22] px-1 text-[0.75rem] font-bold leading-[1.4] text-white">{opp.look.title}</span>}
                <span className="truncate">{opp.name}</span>
                <Flag code={opp.look?.country_code} size={22} />
              </p>
              <p className="text-[0.8125rem] text-muted">{[opp.rating, country, opp.color].filter(Boolean).join(" · ")}</p>
            </div>
          </>
        ) : (
          <div className="min-w-0">
            <p className="label-data">Game</p>
            <p className="mono text-[1.375rem] leading-tight text-ink">{r.fallbackTitle}</p>
          </div>
        )}
      </Tile>
      <Tile label="Result">
        <p className={`mono text-[1.375rem] font-bold uppercase leading-tight ${r.result ? TONE[r.result.tone] : "text-ink"}`}>{r.result?.text ?? "Not played"}</p>
        {r.me && <p className="text-[0.8125rem] text-muted">You {[r.me.rating, r.me.color].filter(Boolean).join(" · ")}</p>}
      </Tile>
      <Tile label="Game">
        <p className="mono text-[1.375rem] leading-tight text-ink">{r.game.main}</p>
        <p className="text-[0.8125rem] text-muted">{r.game.sub}</p>
      </Tile>
      <Tile className="flex items-center gap-3">
        <span className="relative shrink-0">
        <svg width="58" height="58" viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="24" fill="none" stroke="var(--border)" strokeWidth="6" />
          {r.accuracy.mine !== null && (
            <circle className="ring-in" cx="30" cy="30" r="24" fill="none" stroke="var(--brass)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} transform="rotate(-90 30 30)" />
          )}
        </svg>
        <span className="mono absolute inset-0 flex items-center justify-center text-[0.9375rem] font-bold text-ink">
          {r.accuracy.mine !== null ? <CountUp to={r.accuracy.mine} decimals={1} /> : "?"}
        </span>
        </span>
        <div>
          <p className="label-data">Accuracy</p>
          {r.accuracy.theirs !== null && <p className="text-[0.8125rem] text-muted">them {r.accuracy.theirs.toFixed(1)}</p>}
          {r.accuracy.chesscom !== null && <p className="text-[0.8125rem] text-muted">chess.com {r.accuracy.chesscom.toFixed(1)}</p>}
        </div>
      </Tile>
      <Tile className="flex items-center">
        {r.gameId ? <ReanalyzeButton gameId={r.gameId} className="btn btn-gold-outline w-full" /> : <p className="text-sm text-muted">Sample game</p>}
      </Tile>
    </section>
  );
}
