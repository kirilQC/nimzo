"use client";

import { CountUp } from "@/components/motion";
import { Icon, SectionHead, type IconName } from "@/components/icons";

export type StatGame = {
  end: string;
  timeClass: string;
  result: "win" | "loss" | "draw";
  ending: string;
  moves: number | null;
  opening: string | null;
  accuracy: number | null;
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const tally = (list: StatGame[]) => ({ w: list.filter((g) => g.result === "win").length, l: list.filter((g) => g.result === "loss").length, d: list.filter((g) => g.result === "draw").length });

/** Win rate per time control, each with a ring and its icon. Click one to filter the list. */
export function ModeCards({ games, active, onPick }: { games: StatGame[]; active: string; onPick: (mode: string) => void }) {
  const modes: [string, string, IconName][] = [
    ["rapid", "Rapid", "stopwatch"],
    ["blitz", "Blitz", "bolt"],
    ["bullet", "Bullet", "target"],
    ["daily", "Daily", "sun"],
  ];
  const present = modes.filter(([id]) => games.some((g) => g.timeClass === id));
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {present.map(([id, name, icon]) => {
        const list = games.filter((g) => g.timeClass === id);
        const t = tally(list);
        const p = pct(t.w, list.length);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(active === id ? "all" : id)}
            aria-pressed={active === id}
            className={`card lift flex items-center gap-4 px-5 py-4 text-left ${active === id ? "border-gold" : ""}`}
          >
            <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 64 64" className="absolute inset-0" aria-hidden="true">
                <circle cx="32" cy="32" r="26" fill="none" stroke="var(--chip)" strokeWidth="7" />
                <circle className="ring-in" cx="32" cy="32" r="26" fill="none" stroke="var(--win)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(p / 100) * 163.4} 163.4`} transform="rotate(-90 32 32)" />
              </svg>
              <Icon name={icon} size={22} />
            </span>
            <span>
              <span className="label-data block text-gold">{name}</span>
              <span className="font-[family-name:var(--font-poster)] text-[1.75rem] leading-tight text-ink">
                <CountUp to={p} />%
              </span>
              <span className="block text-[0.8125rem] text-muted">{list.length.toLocaleString("en-US")} games</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const SHADES = {
  win: ["#8fd3a8", "#6fb88b", "#4f9a6e", "#3a7a55"],
  loss: ["#ff7a62", "#e0624d", "#b84d3c", "#8f3b2e"],
  draw: ["#cfc6a8", "#a39a7c", "#7d7560", "#5e5848", "#4a4538"],
} as const;
const PLURAL = { win: "Wins", loss: "Losses", draw: "Draws" } as const;

/** Three donuts: wins, losses and draws, each split by how the game ended. */
export function EndingDonuts({ games }: { games: StatGame[] }) {
  return (
    <section className="card" aria-labelledby="endings-h">
      <SectionHead icon="flag" title="How your games end" sub={`${games.length.toLocaleString("en-US")} games`} id="endings-h" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(["win", "loss", "draw"] as const).map((r) => {
          const list = games.filter((g) => g.result === r);
          const by = [...list.reduce((m, g) => m.set(g.ending, (m.get(g.ending) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
          const C = 2 * Math.PI * 62;
          let acc = 0;
          return (
            <div key={r} className="flex items-center gap-5">
              <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`${list.length} ${PLURAL[r].toLowerCase()} by how they ended`} className="shrink-0">
                <circle cx="75" cy="75" r="62" fill="none" stroke="var(--chip)" strokeWidth="20" />
                {by.map(([how, n], i) => {
                  const len = (n / Math.max(1, list.length)) * C;
                  const el = (
                    <circle key={how} className="ring-in" cx="75" cy="75" r="62" fill="none" stroke={SHADES[r][i % SHADES[r].length]} strokeWidth="20" strokeDasharray={`${len} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 75 75)" style={{ animationDelay: `${200 + i * 150}ms` }} />
                  );
                  acc += len;
                  return el;
                })}
                <text x="75" y="80" textAnchor="middle" fontFamily="var(--font-anton)" fontSize="30" fill="var(--ink)">
                  {list.length}
                </text>
                <text x="75" y="100" textAnchor="middle" fontFamily="var(--font-barlow-c)" fontSize="12" letterSpacing="2" fill={r === "win" ? "var(--win)" : r === "loss" ? "var(--loss)" : "#cfc6a8"}>
                  {PLURAL[r].toUpperCase()}
                </text>
              </svg>
              <ul className="space-y-1 text-[0.875rem]">
                {by.map(([how, n], i) => (
                  <li key={how} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SHADES[r][i % SHADES[r].length] }} aria-hidden="true" />
                    <span className="text-ink">{how}</span>
                    <span className="mono text-[0.8125rem] text-muted">{n}</span>
                  </li>
                ))}
                {!by.length && <li className="text-muted">None yet</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The last four months, one square per day; days you played show your record. Click a day to list its games. */
export function PlayCalendar({ games, selected, onPick, today }: { games: StatGame[]; selected: string | null; onPick: (day: string | null) => void; today: number }) {
  const days = new Map<string, { w: number; l: number; d: number }>();
  for (const g of games) {
    const k = localDay(g.end);
    const t = days.get(k) ?? { w: 0, l: 0, d: 0 };
    t[g.result === "win" ? "w" : g.result === "loss" ? "l" : "d"]++;
    days.set(k, t);
  }
  const now = new Date(today);
  const months = [3, 2, 1, 0].map((back) => new Date(now.getFullYear(), now.getMonth() - back, 1));
  return (
    <section className="card" aria-labelledby="cal-h">
      <SectionHead icon="calendar" title="When you played" sub="Click a day to see its games" id="cal-h" />
      <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
        {months.map((m) => {
          const first = m.getDay(), count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          return (
            <div key={m.toISOString()}>
              <p className="label-data mb-2 text-gold">{m.toLocaleDateString("en-US", { month: "long" })}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: first }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const date = new Date(m.getFullYear(), m.getMonth(), i + 1);
                  const k = keyOf(date);
                  const t = days.get(k);
                  const future = date.getTime() > today;
                  const good = t && t.w >= t.l;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={!t}
                      onClick={() => onPick(selected === k ? null : k)}
                      aria-pressed={selected === k}
                      aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${t ? `: ${t.w} won, ${t.l} lost` : ", no games"}`}
                      className={`flex h-11 flex-col items-center justify-center rounded-[8px] border text-[0.75rem] transition-transform ${
                        t
                          ? `${good ? "border-[color:var(--win)] bg-[rgba(143,211,168,0.18)]" : "border-[color:var(--loss)] bg-[rgba(255,122,98,0.18)]"} text-ink hover:scale-105 ${selected === k ? "ring-2 ring-gold" : ""}`
                          : `border-transparent bg-[#0b1f17] ${future ? "text-[#3d4a42]" : "text-muted"} cursor-default`
                      }`}
                    >
                      {i + 1}
                      {t && (
                        <span className="mono text-[0.625rem] font-bold leading-none">
                          {t.w}W {t.l}L
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** How many games fall in each accuracy band, and how often you win in each. */
export function AccuracyBands({ games }: { games: StatGame[] }) {
  const bands: [string, number, number][] = [["Under 40", 0, 40], ["40 to 55", 40, 55], ["55 to 70", 55, 70], ["70 to 85", 70, 85], ["85+", 85, 101]];
  const rated = games.filter((g) => g.accuracy !== null);
  const sorted = rated.map((g) => g.accuracy!).sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2) : null;
  const data = bands.map(([name, lo, hi]) => {
    const list = rated.filter((g) => g.accuracy! >= lo && g.accuracy! < hi);
    return { name, n: list.length, won: pct(list.filter((g) => g.result === "win").length, list.length) };
  });
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <section className="card" aria-labelledby="acc-h">
      <SectionHead icon="target" title="Accuracy" sub={median !== null ? `Your typical game is ${median.toFixed(1)} across ${rated.length} analyzed games` : "No analyzed games yet"} id="acc-h" />
      <div className="flex h-[230px] items-end gap-3">
        {data.map((d, i) => (
          <div key={d.name} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="mono text-[0.875rem] text-ink">{d.won}% won</span>
            <span className="grow-y block w-full rounded-[8px]" style={{ height: `${(d.n / max) * 150}px`, background: "var(--brass)", opacity: 0.35 + i * 0.15, animationDelay: `${i * 80}ms` }} />
            <span className="mono text-[0.8125rem] text-muted">{d.name}</span>
            <span className="text-[0.75rem] text-muted">{d.n} games</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Win, draw and loss share by how long the game lasted. */
export function GameLength({ games }: { games: StatGame[] }) {
  const bands: [string, number, number][] = [["Under 20 moves", 0, 20], ["21 to 30", 21, 30], ["31 to 40", 31, 40], ["41 to 60", 41, 60], ["61 or more", 61, 9999]];
  const data = bands.map(([name, lo, hi]) => {
    const list = games.filter((g) => g.moves !== null && g.moves >= lo && g.moves <= hi);
    return { name, n: list.length, ...tally(list) };
  });
  const quick = data[0]!;
  return (
    <section className="card" aria-labelledby="len-h">
      <SectionHead icon="ruler" title="Game length" sub="How often you win, by how long the game lasts" id="len-h" />
      <ul className="space-y-3.5">
        {data.map((d, i) => (
          <li key={d.name} className="grid grid-cols-[120px_1fr_48px] items-center gap-3">
            <span className="text-[0.875rem] text-ink">{d.name}</span>
            <span className="flex h-6 overflow-hidden rounded-[6px] bg-[#0b1f17]" aria-label={`${d.w} won, ${d.d} drawn, ${d.l} lost`}>
              <span className="bar-grow h-full bg-[color:var(--win)]" style={{ width: `${pct(d.w, d.n)}%`, animationDelay: `${i * 90}ms` }} />
              <span className="bar-grow h-full bg-[#cfc6a8]" style={{ width: `${pct(d.d, d.n)}%`, animationDelay: `${i * 90 + 80}ms` }} />
              <span className="bar-grow h-full bg-[color:var(--loss)]" style={{ width: `${pct(d.l, d.n)}%`, animationDelay: `${i * 90 + 160}ms` }} />
            </span>
            <span className={`mono text-right text-[1rem] ${pct(d.w, d.n) >= 50 ? "text-good" : "text-[color:var(--loss)]"}`}>{pct(d.w, d.n)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[0.8125rem] text-body2">
        You win <strong className={pct(quick.w, quick.n) >= 50 ? "text-good" : "text-[color:var(--loss)]"}>{pct(quick.w, quick.n)}%</strong> of games under 20 moves.{" "}
        <span className="text-good">■</span> won <span className="text-[#cfc6a8]">■</span> drawn <span className="text-[color:var(--loss)]">■</span> lost
      </p>
    </section>
  );
}

/** Your ten most played openings as bars sized by games, labelled with how often you win. Click one to list its games. */
export function OpeningBars({ games, onPick }: { games: StatGame[]; onPick: (opening: string) => void }) {
  const by = new Map<string, StatGame[]>();
  for (const g of games) if (g.opening) by.set(g.opening, [...(by.get(g.opening) ?? []), g]);
  const top = [...by].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const max = top[0]?.[1].length ?? 1;
  return (
    <section className="card" aria-labelledby="open-h">
      <SectionHead icon="book" title="Top 10 openings" sub="Click one to see those games" id="open-h" />
      <ul className="space-y-2">
        {top.map(([name, list], i) => {
          const won = pct(tally(list).w, list.length);
          return (
            <li key={name}>
              <button type="button" onClick={() => onPick(name)} className="group grid w-full grid-cols-[minmax(0,320px)_1fr] items-center gap-4 text-left">
                <span className="truncate text-right text-[0.875rem] font-semibold text-ink group-hover:text-gold">{name}</span>
                <span className="flex items-center gap-3">
                  <span
                    className="bar-grow flex h-7 items-center justify-end rounded-r-[8px] pr-2.5 font-[family-name:var(--font-barlow-c)] text-[0.875rem] font-bold text-[color:var(--on-gold)] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${(list.length / max) * 78}%`, minWidth: 40, background: `linear-gradient(90deg, var(--gold-rule), ${won >= 50 ? "var(--win)" : "var(--brass)"})`, animationDelay: `${i * 60}ms` }}
                  >
                    {list.length}
                  </span>
                  <span className={`mono whitespace-nowrap text-[0.875rem] ${won >= 50 ? "text-good" : "text-[color:var(--loss)]"}`}>{won}% won</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
