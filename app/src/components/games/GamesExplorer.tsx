"use client";

import { useMemo, useRef, useState } from "react";
import { RatingJourney } from "./RatingJourney";
import { AccuracyBands, EndingDonuts, GameLength, ModeCards, OpeningBars, PlayCalendar } from "./GameStats";
import { HistoryTable, type HistoryRow } from "@/components/home/GameHistory";
import { SectionHead } from "@/components/icons";
import type { PlayerLook } from "@/components/PlayerBadge";

export type ExplorerGame = {
  id: string;
  end: string; // ISO
  color: "white" | "black";
  opponent: string;
  oppLook: PlayerLook | null;
  oppRating: number | null;
  myRating: number | null;
  result: "win" | "loss" | "draw";
  ending: string; // "Opponent resigned"
  endingShort: string; // "Resignation"
  moves: number | null;
  timeClass: string;
  timeControl: string | null;
  opening: string | null;
  eco: string | null;
  accuracy: number | null;
  oppAccuracy: number | null;
  status: string;
};

const PAGE = 25;
const CLASS_ORDER = ["rapid", "blitz", "bullet", "daily", "other"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * My games: the rating section, win rate by time control, how games end, the
 * calendar, accuracy and game length, top openings, then every game. Clicking a
 * mode, a day or an opening filters the list at the bottom and scrolls to it.
 */
export function GamesExplorer({ games, me, myLook }: { games: ExplorerGame[]; me: string; myLook: PlayerLook | null }) {
  const [q, setQ] = useState("");
  const [timeClass, setTimeClass] = useState("all");
  const [result, setResult] = useState<"all" | "win" | "loss" | "draw">("all");
  const [color, setColor] = useState<"all" | "white" | "black">("all");
  const [day, setDay] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [today] = useState(() => Date.now());
  const listRef = useRef<HTMLElement>(null);

  const classes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const g of games) seen.set(g.timeClass, (seen.get(g.timeClass) ?? 0) + 1);
    return CLASS_ORDER.filter((c) => seen.has(c)).map((c) => ({ id: c, count: seen.get(c)! }));
  }, [games]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return games.filter(
      (g) =>
        (timeClass === "all" || g.timeClass === timeClass) &&
        (result === "all" || g.result === result) &&
        (color === "all" || g.color === color) &&
        (!day || localDay(g.end) === day) &&
        (!needle || [g.opponent, g.opening, g.eco, g.ending].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [games, q, timeClass, result, color, day]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows: HistoryRow[] = filtered.slice(page * PAGE, page * PAGE + PAGE).map((g) => ({
    id: g.id,
    end: g.end,
    timeClass: g.timeClass,
    timeControl: g.timeControl,
    color: g.color,
    result: g.result,
    opponent: g.opponent,
    oppRating: g.oppRating,
    myRating: g.myRating,
    oppLook: g.oppLook,
    myAcc: g.accuracy,
    oppAcc: g.oppAccuracy,
    moves: g.moves,
    opening: g.opening,
    ending: g.ending,
  }));

  /** Apply a filter from the stats above and bring the list into view. */
  const focus = (fn: () => void) => {
    fn();
    setPage(0);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const active = [
    day && { label: new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), clear: () => setDay(null) },
    q && { label: `“${q}”`, clear: () => setQ("") },
    timeClass !== "all" && { label: cap(timeClass), clear: () => setTimeClass("all") },
    result !== "all" && { label: cap(result === "loss" ? "losses" : result + "s"), clear: () => setResult("all") },
    color !== "all" && { label: `As ${cap(color)}`, clear: () => setColor("all") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="space-y-5">
      <RatingJourney games={games} initial={timeClass === "all" ? undefined : timeClass} />

      <ModeCards games={games} active={timeClass} onPick={(m) => focus(() => setTimeClass(m))} />
      <EndingDonuts games={games} />
      <PlayCalendar games={games} selected={day} onPick={(d) => focus(() => setDay(d))} today={today} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <AccuracyBands games={games} />
        <GameLength games={games} />
      </div>
      <OpeningBars games={games} onPick={(name) => focus(() => setQ(name))} />

      <section ref={listRef} aria-labelledby="list-h" className="scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead icon="swords" title="All games" sub={`${filtered.length.toLocaleString("en-US")} ${filtered.length === 1 ? "game" : "games"}${filtered.length !== games.length ? ` of ${games.length.toLocaleString("en-US")}` : ""} · newest first`} id="list-h" />
        </div>
        <div className="card mb-3 flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[220px] flex-1">
            <span className="label-data mb-1 block">Search</span>
            <input
              className="input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Opponent, opening, ECO, or how it ended"
            />
          </label>
          <Select label="Time control" value={timeClass} onChange={(v) => { setTimeClass(v); setPage(0); }} options={[["all", `All (${games.length})`], ...classes.map((c) => [c.id, `${cap(c.id)} (${c.count})`] as [string, string])]} />
          <Select label="Result" value={result} onChange={(v) => { setResult(v as typeof result); setPage(0); }} options={[["all", "All"], ["win", "Wins"], ["loss", "Losses"], ["draw", "Draws"]]} />
          <Select label="Colour" value={color} onChange={(v) => { setColor(v as typeof color); setPage(0); }} options={[["all", "Both"], ["white", "White"], ["black", "Black"]]} />
        </div>
        {active.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {active.map((a) => (
              <button key={a.label} type="button" onClick={() => { a.clear(); setPage(0); }} className="inline-flex items-center gap-2 rounded-full border border-gold bg-[rgba(227,195,90,0.1)] px-3 py-1 text-[0.8125rem] font-semibold text-gold">
                {a.label} <span aria-hidden="true">×</span>
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
          </div>
        )}
        {rows.length ? (
          <HistoryTable rows={rows} me={me} myLook={myLook ?? undefined} details tint caption="Your games, newest first" />
        ) : (
          <p className="card text-sm text-muted">No games match these filters.</p>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-[0.875rem] text-muted">
            <span>
              Showing {page * PAGE + 1} to {Math.min(filtered.length, (page + 1) * PAGE)} of {filtered.length.toLocaleString("en-US")}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Newer
              </button>
              <span className="mono text-ink">
                {page + 1} / {pages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Older
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label>
      <span className="label-data mb-1 block">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
