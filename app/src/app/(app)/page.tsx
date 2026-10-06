import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SessionCard } from "@/components/home/SessionCard";
import { GameHistory } from "@/components/home/GameHistory";
import { CostingBars } from "@/components/home/CostingBars";
import { getPatternStats, getRecentGames, getSettings, needsBackfill } from "@/lib/data";
import { getOpenSession, getSessionGames } from "@/lib/sessions";
import { getPlayers } from "@/lib/chesscom/players";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";

const WINDOW = 30;
const HISTORY = 30;

export default async function HomePage() {
  const me = env().CHESSCOM_USERNAME;
  const [games, stats, settings, backfill, openSession] = await Promise.all([
    getRecentGames(HISTORY, ["rapid", "blitz", "bullet", "daily"]),
    getPatternStats(WINDOW),
    getSettings(),
    needsBackfill(),
    getOpenSession(),
  ]);
  const db = await getDb();
  const [openSessionGames, looks, { data: analysis }] = await Promise.all([
    openSession ? getSessionGames(openSession.id) : Promise.resolve([]),
    getPlayers([me, ...games.map((g) => g.opponent)]),
    games.length
      ? db.from(T.game_analysis).select("game_id, accuracy_opponent").in("game_id", games.map((g) => g.id))
      : Promise.resolve({ data: [] as { game_id: string; accuracy_opponent: number | null }[] }),
  ]);
  const oppAccuracy = new Map((analysis ?? []).map((a) => [a.game_id as string, a.accuracy_opponent === null ? null : Number(a.accuracy_opponent)]));
  const topStats = stats.slice(0, 5);

  return (
    <div className="space-y-14">
      <div>
        <SessionCard
          openSession={openSession}
          openSessionGames={openSessionGames}
          needsBackfill={backfill}
          autoOffMinutes={settings.session_auto_off_minutes ?? 60}
          backfillMonths={settings.backfill_months ?? 3}
        />
        <figure className="mx-auto mt-10 max-w-[720px] text-center">
          <blockquote className="font-[family-name:var(--font-display)] text-[1.75rem] italic leading-snug text-body2">
            {settings.coach_note
              ? `“${settings.coach_note}”`
              : "“Play a few games with Session mode on, and I'll tell you the habit that's costing you the most.”"}
          </blockquote>
        </figure>
      </div>

      <section aria-labelledby="costing-h">
        <h2 id="costing-h" className="mb-5 font-[family-name:var(--font-poster)] text-[1.75rem] font-normal uppercase tracking-[0.01em]">
          What keeps costing you
        </h2>
        {topStats.length ? (
          <CostingBars stats={topStats} windowGames={WINDOW} />
        ) : (
          <p className="text-sm text-muted">Patterns appear once a few games have been analyzed and tagged.</p>
        )}
      </section>

      <section aria-labelledby="history-h">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="history-h" className="text-[1.5rem]">
            Game History
          </h2>
          <Link href="/games" className="font-bold text-gold underline underline-offset-4">
            All games
          </Link>
        </div>
        {games.length ? (
          <GameHistory games={games} me={me} looks={looks} oppAccuracy={oppAccuracy} />
        ) : (
          <div className="card">
            <EmptyState title="No games yet">
              Games show up here after the first sync with chess.com.{" "}
              <Link href="/games/sample" className="link">
                See a sample review
              </Link>
            </EmptyState>
          </div>
        )}
      </section>
    </div>
  );
}
