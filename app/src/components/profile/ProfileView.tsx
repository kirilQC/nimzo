"use client";

import Link from "next/link";
import { useState } from "react";
import { CoachAvatar } from "@/components/coach/CoachAvatar";
import { RatingChart } from "@/components/games/RatingChart";
import type { ProfileStats } from "@/lib/profile/stats";
import type { WrittenProfile } from "@/lib/profile/synthesize";

type Tag = ProfileStats["weaknesses"][number];
type Condition = ProfileStats["conditions"][number];

const TREND: Record<string, { text: string; className: string }> = {
  improving: { text: "Improving", className: "bg-[#e8f0dc] text-[#3d6b22]" },
  worse: { text: "Getting worse", className: "bg-[#f6dcd6] text-[#8a2c22]" },
  steady: { text: "Steady", className: "bg-chip text-body2" },
  new: { text: "Recent", className: "bg-chip text-body2" },
};

const fmt = (x: number | null | undefined, suffix = "") => (x === null || x === undefined ? "–" : `${x}${suffix}`);

/** The player's profile: Arthur's portrait, what holds him back, when, and the plan, with every number behind it. */
export function ProfileView({ stats, profile, lessonTitles }: { stats: ProfileStats; profile: WrittenProfile | null; lessonTitles: Record<string, string> }) {
  const tagById = new Map([...stats.weaknesses, ...stats.strengths].map((t) => [t.id, t]));
  const examplesFor = (ids: string[]) => {
    const seen = new Set<string>();
    return ids
      .flatMap((id) => tagById.get(id)?.examples ?? [])
      .filter((e) => (seen.has(`${e.game_id}:${e.ply}`) ? false : (seen.add(`${e.game_id}:${e.ply}`), true)))
      .slice(0, 4);
  };

  return (
    <div className="space-y-6">
      {/* Arthur's portrait of the player */}
      <section className="card p-6" aria-labelledby="style-h">
        <div className="flex gap-5">
          <CoachAvatar size={72} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Arthur on how you play</p>
            <h2 id="style-h" className="mt-1 text-2xl">
              {profile?.style.title ?? "Your profile"}
            </h2>
            <div className="mt-2 space-y-2 text-body2">{profile?.style.summary.map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Games" value={stats.games} />
          <Stat label="Score" value={fmt(stats.results.score, "%")} hint={`${stats.results.wins}W ${stats.results.losses}L ${stats.results.draws}D`} />
          <Stat label="Accuracy" value={fmt(stats.accuracy.overall)} hint={`last 100: ${fmt(stats.accuracy.recent_100)}`} />
          <Stat label="Blunders a game" value={fmt(stats.per_game.blunders)} hint={`+ ${fmt(stats.per_game.misses)} misses`} />
          <Stat label="Rating" value={fmt(stats.rating.current)} hint={`peak ${fmt(stats.rating.peak)}`} />
          <Stat label="Wins from winning spots" value={fmt(stats.conversion.conversion_rate, "%")} hint={`${stats.conversion.won_from_winning} of ${stats.conversion.had_winning_position}`} />
        </div>
      </section>

      {/* What holds you back */}
      {profile && (
        <section aria-labelledby="weak-h">
          <h2 id="weak-h" className="mb-3">
            What&apos;s holding you back
          </h2>
          <ol className="space-y-4">
            {profile.weaknesses.map((w, i) => (
              <li key={i} className="card p-5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="mono text-2xl text-[color:var(--blunder-bg)]">{i + 1}</span>
                  <h3 className="text-lg font-semibold text-ink">{w.title}</h3>
                </div>
                <p className="mt-2 text-body2">{w.explanation}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{w.evidence}</p>
                <p className="mt-2 rounded-[8px] bg-[#eef5e6] px-3 py-2 text-sm text-[#2f5419]">
                  <span className="font-semibold">The fix: </span>
                  {w.fix}
                </p>
                <Examples examples={examplesFor(w.tag_ids)} />
                {w.knowledge_ids.length > 0 && <p className="mt-2 text-xs text-muted">Lessons: {w.knowledge_ids.map((id) => lessonTitles[id] ?? id).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Training plan */}
      {profile && (
        <section className="card p-6" aria-labelledby="plan-h">
          <h2 id="plan-h" className="mb-3">
            Your training plan
          </h2>
          <ol className="grid gap-4 lg:grid-cols-3">
            {profile.training_plan.map((t, i) => (
              <li key={i} className="rounded-[10px] border border-line p-4">
                <p className="eyebrow">Focus {i + 1}</p>
                <h3 className="mt-1 font-semibold text-ink">{t.focus}</h3>
                <p className="mt-1.5 text-sm text-body2">{t.why}</p>
                <p className="mt-2 text-sm text-ink">{t.how}</p>
                {t.knowledge_ids.length > 0 && <p className="mt-2 text-xs text-muted">{t.knowledge_ids.map((id) => lessonTitles[id] ?? id).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* When it goes wrong */}
      <section className="card p-6" aria-labelledby="when-h">
        <h2 id="when-h">When your mistakes happen</h2>
        <p className="mt-1 text-sm text-muted">
          Share of your moves that were a mistake, miss or blunder ({stats.base_rates.big_error_rate}% on average). Bold bars are real patterns, not chance.
        </p>
        {profile && profile.patterns.length > 0 && (
          <ul className="mt-4 space-y-2">
            {profile.patterns.map((p, i) => (
              <li key={i} className="text-body2">
                <span className="font-semibold text-ink">{p.insight}</span> <span className="text-sm text-muted">{p.evidence}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {groupBy(stats.conditions, (c) => c.dimension).map(([dim, rows]) => (
            <ConditionBars key={dim} title={dim} rows={rows} base={stats.base_rates.big_error_rate} />
          ))}
        </div>
      </section>

      {/* Fingerprint */}
      <TagTable title="Your mistake fingerprint" subtitle="How often each pattern shows up in your games, and whether your last 100 games are better or worse than before." tags={stats.weaknesses.slice(0, 20)} />

      {/* Strengths */}
      <section className="card p-6" aria-labelledby="strong-h">
        <h2 id="strong-h" className="mb-3">
          Your strengths
        </h2>
        {profile && (
          <ul className="mb-4 grid gap-3 md:grid-cols-2">
            {profile.strengths.map((s, i) => (
              <li key={i} className="rounded-[10px] bg-[#eef5e6] p-4">
                <h3 className="font-semibold text-[#2f5419]">{s.title}</h3>
                <p className="mt-1 text-sm text-body2">{s.explanation}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{s.evidence}</p>
              </li>
            ))}
          </ul>
        )}
        <ul className="flex flex-wrap gap-2">
          {stats.strengths.slice(0, 10).map((t) => (
            <li key={t.id} className="chip bg-[#eef5e6] text-[#3d6b22]">
              {t.label} · <span className="mono">{t.games_pct}%</span> of games
            </li>
          ))}
        </ul>
      </section>

      {/* Blind spots */}
      <section className="card p-6" aria-labelledby="maia-h">
        <h2 id="maia-h">Blind spots vs normal for your level</h2>
        <p className="mt-1 text-sm text-muted">
          Maia predicts how players at your level move. A blind spot is a mistake most of them would not make: fix these first.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="font-semibold text-ink">
              Blind spots: <span className="mono">{fmt(stats.maia.blind_spot_share, "%")}</span> of your mistakes
            </p>
            <ul className="mt-2 space-y-1 text-sm text-body2">
              {stats.maia.blind_spot_tags.map((t) => (
                <li key={t.id}>
                  {t.label} <span className="mono text-muted">×{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink">
              Normal for your level: <span className="mono">{fmt(stats.maia.normal_for_level_share, "%")}</span>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-body2">
              {stats.maia.normal_for_level_tags.map((t) => (
                <li key={t.id}>
                  {t.label} <span className="mono text-muted">×{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Openings */}
      <section className="card table-scroll p-0" aria-labelledby="open-h">
        <div className="px-6 pt-6">
          <h2 id="open-h">Openings</h2>
          {profile && (
            <>
              <p className="mt-2 text-body2">{profile.openings.summary}</p>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <BulletList title="Keep" items={profile.openings.keep} tone="good" />
                <BulletList title="Fix" items={profile.openings.fix} tone="bad" />
              </div>
            </>
          )}
        </div>
        <table className="table mt-3 text-sm">
          <thead>
            <tr>
              <th scope="col">Opening</th>
              <th scope="col">As</th>
              <th scope="col" className="text-right">Games</th>
              <th scope="col" className="text-right">Score</th>
              <th scope="col" className="text-right">Accuracy</th>
              <th scope="col" className="text-right">Opening errors a game</th>
              <th scope="col" className="text-right">Leaves theory by move</th>
            </tr>
          </thead>
          <tbody>
            {stats.openings.map((o) => (
              <tr key={`${o.color}|${o.family}`}>
                <td className="text-walnut" title={o.top_lines.map((l) => `${l.name} (${l.games})`).join(", ")}>
                  {o.family}
                </td>
                <td className="text-body2">{o.color}</td>
                <td className="mono text-right">{o.games}</td>
                <td className="mono text-right">{fmt(o.score, "%")}</td>
                <td className="mono text-right">{fmt(o.accuracy)}</td>
                <td className="mono text-right">{fmt(o.errors_in_opening)}</td>
                <td className="mono text-right">{fmt(o.left_book_move)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Clock and mindset */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="clock-h">
          <h2 id="clock-h">The clock</h2>
          {profile && <p className="mt-2 text-body2">{profile.time.summary}</p>}
          {profile && <p className="mt-2 text-sm font-semibold text-ink">{profile.time.advice}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Fact k="Average time a move" v={fmt(stats.clock.avg_move_time_s, " s")} />
            <Fact k="Games in time trouble" v={fmt(stats.clock.games_with_time_trouble_pct, "%")} />
            <Fact k="Mistakes with under a minute left" v={fmt(stats.clock.errors_under_60s_share, "%")} />
            <Fact k="Mistakes played in 2 s or less" v={fmt(stats.clock.instant_error_share, "%")} />
            <Fact k="Losses on time" v={fmt(stats.clock.losses_on_time)} />
            <Fact k="Time left at the end" v={fmt(stats.clock.avg_time_left_end_s, " s")} />
          </dl>
        </section>
        <section className="card p-6" aria-labelledby="mind-h">
          <h2 id="mind-h">Mindset</h2>
          {profile && <p className="mt-2 text-body2">{profile.mindset.summary}</p>}
          {profile && <p className="mt-2 text-sm font-semibold text-ink">{profile.mindset.advice}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Fact k="Winning positions converted" v={`${fmt(stats.conversion.conversion_rate, "%")} (${stats.conversion.won_from_winning}/${stats.conversion.had_winning_position})`} />
            <Fact k="Games thrown from winning" v={fmt(stats.conversion.threw_winning_games)} />
            <Fact k="Saved from losing spots" v={`${fmt(stats.conversion.comeback_rate, "%")} (${stats.conversion.saved_from_losing}/${stats.conversion.had_losing_position})`} />
            <Fact k="Resigned while still fighting" v={`${stats.endings.resigned_while_still_fighting} of ${stats.endings.resigned_losses}`} />
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <EndingList title="How you lose" rows={stats.endings.losses} />
            <EndingList title="How you win" rows={stats.endings.wins} />
          </div>
        </section>
      </div>

      {/* Progress */}
      <section className="card p-6" aria-labelledby="prog-h">
        <h2 id="prog-h">Progress</h2>
        {profile && <p className="mt-2 text-body2">{profile.progress.summary}</p>}
        <div className="mt-4">
          <RatingChart
            series={[
              { id: "acc", label: "Accuracy", color: "#4E7A3A", points: stats.by_month.filter((m) => m.accuracy !== null).map((m) => ({ t: Date.parse(`${m.month}-15`), rating: Math.round(m.accuracy!) })) },
              { id: "blunders", label: "Blunders a game ×10", color: "#9E2B25", points: stats.by_month.filter((m) => m.blunders_per_game !== null).map((m) => ({ t: Date.parse(`${m.month}-15`), rating: Math.round(m.blunders_per_game! * 10) })) },
            ].filter((s) => s.points.length > 1)}
          />
        </div>
        <p className="mt-2 text-xs text-muted">Monthly averages. Blunders are shown ×10 so both lines fit one scale.</p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft p-3">
      <p className="eyebrow">{label}</p>
      <p className="mono mt-1 text-xl text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="mono text-ink">{v}</dd>
    </div>
  );
}

function Examples({ examples }: { examples: { game_id: string; ply: number; move_number: number | null; date: string }[] }) {
  if (!examples.length) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">See it in your games:</span>
      {examples.map((e) => (
        <Link key={`${e.game_id}:${e.ply}`} href={`/games/${e.game_id}?ply=${e.ply}`} className="chip font-normal no-underline hover:bg-chip/70">
          {e.date}, move {e.move_number}
        </Link>
      ))}
    </p>
  );
}

function BulletList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      <ul className={`list-disc space-y-1 pl-5 text-body2 ${tone === "good" ? "marker:text-[#4e7a3a]" : "marker:text-[color:var(--blunder-bg)]"}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function EndingList({ title, rows }: { title: string; rows: { how: string; count: number }[] }) {
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      <ul className="space-y-0.5">
        {rows.slice(0, 5).map((r) => (
          <li key={r.how} className="flex justify-between gap-2 text-body2">
            <span>{r.how}</span>
            <span className="mono text-ink">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConditionBars({ title, rows, base }: { title: string; rows: Condition[]; base: number }) {
  const max = Math.max(base * 2, ...rows.map((r) => r.big_error_rate ?? 0));
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const w = ((r.big_error_rate ?? 0) / max) * 100;
          const above = (r.big_error_rate ?? 0) > base;
          return (
            <li key={r.bucket} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-sm">
              <span className="truncate text-body2" title={`${r.moves} moves`}>
                {r.bucket}
              </span>
              <span className="relative h-3 rounded-full bg-chip">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${above ? "bg-[color:var(--blunder-bg)]" : "bg-[#4e7a3a]"} ${r.significant ? "opacity-100" : "opacity-35"}`}
                  style={{ width: `${w}%` }}
                />
                <span className="absolute inset-y-[-3px] w-px bg-ink/60" style={{ left: `${(base / max) * 100}%` }} aria-hidden="true" />
              </span>
              <span className={`mono text-right ${r.significant ? "font-semibold text-ink" : "text-muted"}`}>{fmt(r.big_error_rate, "%")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TagTable({ title, subtitle, tags }: { title: string; subtitle: string; tags: Tag[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card table-scroll p-0" aria-labelledby="fp-h">
      <div className="px-6 pt-6">
        <h2 id="fp-h">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <table className="table mt-3 text-sm">
        <thead>
          <tr>
            <th scope="col">Pattern</th>
            <th scope="col" className="text-right">Games</th>
            <th scope="col" className="text-right">A game</th>
            <th scope="col" className="text-right">Last 100</th>
            <th scope="col">Trend</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((t) => (
            <tr key={t.id} className="cursor-pointer" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <td>
                <span className="font-semibold text-ink">{t.label}</span>
                {open === t.id && (
                  <span className="mt-1 block text-body2">
                    {t.plain}
                    <Examples examples={t.examples} />
                  </span>
                )}
              </td>
              <td className="mono text-right">{t.games_pct}%</td>
              <td className="mono text-right">{t.per_game}</td>
              <td className="mono text-right">{t.recent_per_game}</td>
              <td>
                <span className={`chip ${TREND[t.trend]?.className ?? ""}`}>{TREND[t.trend]?.text ?? t.trend}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) (m.get(key(x)) ?? m.set(key(x), []).get(key(x))!).push(x);
  return [...m];
}
