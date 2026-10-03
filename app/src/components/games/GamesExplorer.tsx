"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RatingChart, type RatingSeries } from "./RatingChart";

export type ExplorerGame = {
  id: string;
  end: string; // ISO
  color: "white" | "black";
  opponent: string;
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
  accuracyChesscom: number | null;
  status: string;
  blunders: number | null;
  misses: number | null;
  mistakes: number | null;
};

type SortKey = "end" | "opponent" | "oppRating" | "myRating" | "result" | "moves" | "accuracy" | "opening" | "timeClass";
const PAGE = 50;
const CLASS_ORDER = ["bullet", "blitz", "rapid", "daily", "other"];
const CLASS_COLOR: Record<string, string> = { bullet: "#9E2B25", blitz: "#C9832E", rapid: "#4E7A3A", daily: "#3F6E9A", other: "#7A6A58" };
const RESULT_TEXT = { win: "Win", loss: "Loss", draw: "Draw" } as const;
const RESULT_RANK = { win: 2, draw: 1, loss: 0 } as const;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** All games: filters, headline stats, rating journey, openings, and a sortable, searchable table. */
export function GamesExplorer({ games }: { games: ExplorerGame[] }) {
  const [q, setQ] = useState("");
  const [timeClass, setTimeClass] = useState("all");
  const [result, setResult] = useState<"all" | "win" | "loss" | "draw">("all");
  const [color, setColor] = useState<"all" | "white" | "black">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "end", dir: -1 });
  const [page, setPage] = useState(0);

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
        (!needle ||
          g.opponent.toLowerCase().includes(needle) ||
          (g.opening ?? "").toLowerCase().includes(needle) ||
          (g.eco ?? "").toLowerCase().includes(needle) ||
          g.ending.toLowerCase().includes(needle)),
    );
  }, [games, q, timeClass, result, color]);

  const sorted = useMemo(() => {
    const val = (g: ExplorerGame): string | number | null => {
      switch (sort.key) {
        case "end":
          return g.end;
        case "result":
          return RESULT_RANK[g.result];
        case "opening":
          return g.opening?.toLowerCase() ?? null;
        case "opponent":
          return g.opponent.toLowerCase();
        default:
          return g[sort.key];
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // blanks last either way
      if (y === null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const shown = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  const stats = useMemo(() => summarize(filtered), [filtered]);
  const series = useMemo<RatingSeries[]>(() => {
    const pick = timeClass === "all" ? classes.map((c) => c.id) : [timeClass];
    return pick
      .map((c) => ({
        id: c,
        label: cap(c),
        color: CLASS_COLOR[c] ?? CLASS_COLOR.other!,
        points: games
          .filter((g) => g.timeClass === c && g.myRating !== null)
          .map((g) => ({ t: Date.parse(g.end), rating: g.myRating! }))
          .sort((a, b) => a.t - b.t),
      }))
      .filter((s) => s.points.length > 1);
  }, [games, classes, timeClass]);

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "end" || key === "accuracy" || key === "myRating" || key === "oppRating" ? -1 : 1 }));
    setPage(0);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[220px] flex-1">
          <span className="eyebrow mb-1 block">Search</span>
          <input className="input" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Opponent, opening, ECO, or how it ended" />
        </label>
        <Select label="Time control" value={timeClass} onChange={resetPage(setTimeClass)} options={[["all", `All (${games.length})`], ...classes.map((c) => [c.id, `${cap(c.id)} (${c.count})`] as [string, string])]} />
        <Select label="Result" value={result} onChange={resetPage((v: string) => setResult(v as typeof result))} options={[["all", "All"], ["win", "Wins"], ["loss", "Losses"], ["draw", "Draws"]]} />
        <Select label="Colour" value={color} onChange={resetPage((v: string) => setColor(v as typeof color))} options={[["all", "Both"], ["white", "White"], ["black", "Black"]]} />
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Games" value={stats.total.toLocaleString("en-US")} hint={`${stats.white} as White · ${stats.black} as Black`} />
        <Tile
          label="Win rate"
          value={`${pct(stats.wins, stats.total)}%`}
          hint={`${stats.wins} W · ${stats.losses} L · ${stats.draws} D (${pct(stats.losses, stats.total)}% lost, ${pct(stats.draws, stats.total)}% drawn)`}
        />
        <Tile
          label={timeClass === "all" ? "Rating now" : `${cap(timeClass)} rating`}
          value={stats.current ?? "–"}
          hint={stats.peak ? `Peak ${stats.peak.rating} on ${fmtDate(stats.peak.end)}` : undefined}
        />
        <Tile label="Most played opening" value={<span className="text-lg">{stats.openings[0]?.name ?? "–"}</span>} hint={stats.openings[0] ? `${stats.openings[0].games} games · ${pct(stats.openings[0].wins, stats.openings[0].games)}% won` : undefined} />
      </div>

      {/* Rating journey */}
      <section className="card" aria-labelledby="rating-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rating-h">Rating journey</h2>
          <ul className="flex flex-wrap gap-3 text-sm text-body2">
            {series.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}: <span className="mono text-ink">{s.points.at(-1)!.rating}</span>
                <span className="text-muted">(started {s.points[0]!.rating})</span>
              </li>
            ))}
          </ul>
        </div>
        {series.length ? <RatingChart series={series} /> : <p className="text-sm text-muted">Not enough rated games to draw a line.</p>}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Openings */}
        <section className="card table-scroll p-0" aria-labelledby="openings-h">
          <h2 id="openings-h" className="px-5 pt-5">
            Openings
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Opening</th>
                <th scope="col" className="text-right">Games</th>
                <th scope="col" className="text-right">Win %</th>
                <th scope="col" className="text-right">W / L / D</th>
              </tr>
            </thead>
            <tbody>
              {stats.openings.slice(0, 10).map((o) => (
                <tr key={o.name} className="cursor-pointer" onClick={() => resetPage(setQ)(o.name)} title="Show these games">
                  <td className="max-w-[240px] truncate text-walnut">{o.name}</td>
                  <td className="mono text-right text-ink">{o.games}</td>
                  <td className="mono text-right text-ink">{pct(o.wins, o.games)}</td>
                  <td className="mono text-right text-body2">
                    {o.wins} / {o.losses} / {o.draws}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* How games end */}
        <section className="card" aria-labelledby="endings-h">
          <h2 id="endings-h" className="mb-3">
            How games end
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["win", "loss", "draw"] as const).map((r) => (
              <div key={r}>
                <p className="eyebrow mb-1">
                  {RESULT_TEXT[r]}s · {r === "win" ? stats.wins : r === "loss" ? stats.losses : stats.draws}
                </p>
                <ul className="space-y-0.5 text-sm">
                  {stats.endings[r].map(([how, n]) => (
                    <li key={how} className="flex justify-between gap-2">
                      <span className="text-body2">{how}</span>
                      <span className="mono text-ink">{n}</span>
                    </li>
                  ))}
                  {!stats.endings[r].length && <li className="text-muted">None</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Table */}
      <section className="card table-scroll p-0" aria-labelledby="list-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <h2 id="list-h">Games</h2>
          <p className="text-sm text-muted">
            {sorted.length.toLocaleString("en-US")} {sorted.length === 1 ? "game" : "games"}
            {sorted.length !== games.length && " match"}
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <Th label="Date" k="end" sort={sort} onSort={sortBy} />
              <Th label="Opponent" k="opponent" sort={sort} onSort={sortBy} />
              <Th label="Their rating" k="oppRating" sort={sort} onSort={sortBy} right />
              <Th label="My rating" k="myRating" sort={sort} onSort={sortBy} right />
              <Th label="Result" k="result" sort={sort} onSort={sortBy} />
              <th scope="col">How it ended</th>
              <Th label="Moves" k="moves" sort={sort} onSort={sortBy} right />
              <Th label="Time" k="timeClass" sort={sort} onSort={sortBy} />
              <Th label="Opening" k="opening" sort={sort} onSort={sortBy} />
              <Th label="Accuracy" k="accuracy" sort={sort} onSort={sortBy} right />
              <th scope="col">
                <span className="sr-only">Review</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.id}>
                <td className="mono whitespace-nowrap text-body2" suppressHydrationWarning>
                  {fmtDate(g.end)}
                </td>
                <td className="whitespace-nowrap font-semibold text-ink">
                  <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-line align-middle ${g.color === "white" ? "bg-white" : "bg-[#2b2724]"}`} title={`You played ${g.color}`} aria-label={`You played ${g.color}`} />
                  {g.opponent}
                </td>
                <td className="mono text-right text-body2">{g.oppRating ?? "–"}</td>
                <td className="mono text-right text-ink">{g.myRating ?? "–"}</td>
                <td className={g.result === "win" ? "font-semibold text-[#4E7A3A]" : g.result === "loss" ? "font-semibold text-[color:var(--blunder-bg)]" : "text-body2"}>{RESULT_TEXT[g.result]}</td>
                <td className="whitespace-nowrap text-body2">{g.ending}</td>
                <td className="mono text-right text-body2">{g.moves ?? "–"}</td>
                <td className="whitespace-nowrap text-body2" title={g.timeControl ?? undefined}>
                  {cap(g.timeClass)}
                </td>
                <td className="max-w-[200px] truncate text-walnut" title={[g.eco, g.opening].filter(Boolean).join(" ")}>
                  {g.opening ?? "—"}
                </td>
                <td className="mono text-right text-ink" title={g.accuracyChesscom !== null ? `chess.com: ${g.accuracyChesscom.toFixed(1)}` : undefined}>
                  {g.accuracy !== null ? g.accuracy.toFixed(1) : g.status === "imported" ? <span className="text-muted">–</span> : "–"}
                </td>
                <td className="text-right">
                  <Link href={`/games/${g.id}`} className="arrow-link">
                    {g.status === "imported" ? "Analyze" : "Review"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
          <button type="button" className="btn btn-secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ← Newer
          </button>
          <span className="text-muted">
            Page {page + 1} of {pages}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>
            Older →
          </button>
        </div>
      </section>
    </div>
  );
}

function summarize(games: ExplorerGame[]) {
  let wins = 0, losses = 0, draws = 0, white = 0, black = 0;
  const openings = new Map<string, { name: string; games: number; wins: number; losses: number; draws: number }>();
  const endings = { win: new Map<string, number>(), loss: new Map<string, number>(), draw: new Map<string, number>() };
  let peak: { rating: number; end: string } | null = null;
  let latest: ExplorerGame | null = null;
  for (const g of games) {
    if (g.result === "win") wins++;
    else if (g.result === "loss") losses++;
    else draws++;
    if (g.color === "white") white++;
    else black++;
    const name = g.opening ?? "Unknown opening";
    const o = openings.get(name) ?? { name, games: 0, wins: 0, losses: 0, draws: 0 };
    o.games++;
    o[g.result === "win" ? "wins" : g.result === "loss" ? "losses" : "draws"]++;
    openings.set(name, o);
    endings[g.result].set(g.ending, (endings[g.result].get(g.ending) ?? 0) + 1);
    if (g.myRating !== null && (!peak || g.myRating > peak.rating)) peak = { rating: g.myRating, end: g.end };
    if (g.myRating !== null && (!latest || g.end > latest.end)) latest = g;
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total: games.length,
    wins,
    losses,
    draws,
    white,
    black,
    current: latest?.myRating ?? null,
    peak,
    openings: [...openings.values()].filter((o) => o.name !== "Unknown opening").sort((a, b) => b.games - a.games),
    endings: { win: top(endings.win), loss: top(endings.loss), draw: top(endings.draw) },
  };
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mono mt-1 text-2xl text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label>
      <span className="eyebrow mb-1 block">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ label, k, sort, onSort, right }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; right?: boolean }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={right ? "text-right" : undefined}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${active ? "text-ink" : ""}`}>
        {label}
        <span aria-hidden="true" className="text-xs">
          {active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
