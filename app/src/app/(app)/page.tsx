import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { SessionCard } from "@/components/home/SessionCard";
import { GamesTable } from "@/components/home/GamesTable";
import { PatternBars } from "@/components/home/PatternBars";
import { BacklogButton } from "@/components/home/BacklogButton";
import { getPatternStats, getRecentGames, getSettings, needsBackfill } from "@/lib/data";
import { getOpenSession, getSessionGames } from "@/lib/sessions";

const WINDOW = 30;

export default async function HomePage() {
  const [games, stats, settings, backfill, openSession] = await Promise.all([
    getRecentGames(10),
    getPatternStats(WINDOW),
    getSettings(),
    needsBackfill(),
    getOpenSession(),
  ]);
  const openSessionGames = openSession ? await getSessionGames(openSession.id) : [];
  const topStats = stats.slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_330px]">
      <SessionCard
        openSession={openSession}
        openSessionGames={openSessionGames}
        needsBackfill={backfill}
        autoOffMinutes={settings.session_auto_off_minutes ?? 60}
        backfillMonths={settings.backfill_months ?? 3}
      />

      <section className="card-dark flex flex-col p-6" aria-labelledby="note-h">
        <h2 id="note-h" className="eyebrow mb-3">
          Coach&apos;s note
        </h2>
        <p className="serif text-[1.3125rem] leading-snug text-panel-text">
          {settings.coach_note ??
            "Play a few games with Session mode on, and I'll tell you the habit that's costing you the most."}
        </p>
        <p className="mt-3 text-sm text-panel-text-2">
          {settings.coach_note ? `Based on your last ${WINDOW} games.` : "Nothing analyzed yet."}
        </p>
        <Link href="/learn" className="arrow-link mt-auto pt-4">
          Drill this in Learn →
        </Link>
      </section>

      <section aria-labelledby="recent-h" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-h" className="section-title">
            Recent games
          </h2>
          <BacklogButton />
        </div>
        {games.length ? (
          <GamesTable games={games} caption="Recent rapid and blitz games" />
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

      <section aria-labelledby="patterns-h" className="min-w-0">
        <h2 id="patterns-h" className="section-title">
          Recurring patterns
        </h2>
        <div className="card">
          {topStats.length ? (
            <PatternBars stats={topStats} windowGames={WINDOW} />
          ) : (
            <p className="text-sm text-muted">Patterns appear once a few games have been analyzed and tagged.</p>
          )}
          <p className="mt-4 text-xs text-muted">Tags by Jev · last {WINDOW} games</p>
        </div>
      </section>
    </div>
  );
}
