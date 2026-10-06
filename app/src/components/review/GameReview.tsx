"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAnalysis } from "@/components/analysis/AnalysisProvider";
import { Board } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { EvalGraph } from "@/components/board/EvalGraph";
import { phaseSegments } from "@/lib/analysis/phases";
import { SeverityChip, type Severity } from "@/components/ui";
import { MoveIcon } from "@/components/board/MoveIcon";
import { MOVE_LABELS, type LabelId } from "@/lib/analysis/labels";
import { formatClock } from "@/lib/chess/pgn";
import { AnalysisProgress } from "./AnalysisProgress";
import { ArthurPanel } from "@/components/coach/ArthurPanel";
import { GameSummary } from "./GameSummary";
import { CountUp, Shimmer } from "@/components/motion";
import { expressionForGame, expressionForMove } from "@/lib/coach/expressions";

export type ReviewPly = {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenAfter: string;
  clockMs: number | null;
  spentMs: number | null; // time the mover spent on this move
  isMine: boolean;
  severity: Severity | null;
  label: LabelId | null;
  note: string | null; // Arthur's one plain sentence about this move
  tags: { id: string; label: string; polarity: "good" | "bad" }[]; // what happened on this move (rule + Jev)
  bestUci: string | null; // engine's move in the position before this one
  phase: "opening" | "middlegame" | "endgame";
  whitePct: number | null;
};

/** v2 summaries have a headline, verdict and overview; older ones a key moment. */
export type ReviewSummary = {
  version?: number;
  headline?: string;
  verdict?: "excellent" | "good" | "mixed" | "rough";
  // v3: structured
  story?: string[];
  momentum?: string;
  fell_short?: string[];
  went_well?: string | string[];
  conclusion?: string;
  knowledge_used?: string[];
  // v1/v2
  overview?: string;
  key_moment?: string;
  work_on?: string;
};

export type CoachInfo = {
  ply: number;
  explanation: string | null;
  bestMoveSan: string | null; // with move number, e.g. "5. Bxf7+"
  bestMoveEval: string | null;
  bestMoveNote: string | null;
  bestLine: string | null; // numbered SAN line from the engine
  punishLine: string | null; // opponent's best reply after my move, numbered
  punishEval: string | null;
  missedMate: boolean;
  winBefore: number | null; // your winning chances, %
  winAfter: number | null;
  evalBefore: string | null;
  evalAfter: string | null;
  tags: { id: string; label: string; confidence: number | null }[];
  maiaLine: string | null;
  relatedLesson: { href: string; title: string } | null;
};

export type ReviewData = {
  gameId: string | null; // null for the sample layout
  status: string;
  error: string | null;
  startFen: string;
  myColor: "white" | "black";
  plies: ReviewPly[];
  coach: Record<number, CoachInfo>;
  analyzed: boolean;
  summary: ReviewSummary | null;
  result: "win" | "loss" | "draw" | null;
  accuracy: number | null;
  accuracyOpponent: number | null;
  counts: { me: Record<LabelId, number>; opponent: Record<LabelId, number> } | null;
  players?: { me: string; opponent: string };
  initialPly?: number; // open at this move
  ending?: string | null; // how it ended, e.g. "Timeout"
  startClockMs?: number | null; // each side's clock at the start
};

function moveLabel(p: { ply: number; color: "w" | "b"; san: string }, suffix = "") {
  return `${Math.ceil(p.ply / 2)}${p.color === "w" ? "." : "..."} ${p.san}${suffix}`;
}

export function GameReview({ data }: { data: ReviewData }) {
  const { plies, startFen, myColor, coach } = data;
  const firstFlag = plies.find((p) => p.isMine && p.severity)?.ply;
  // With a summary, start at the beginning so Arthur greets you first; Next mistake walks the flagged moves.
  const [current, setCurrent] = useState<number>(data.initialPly ?? (data.summary ? 0 : (firstFlag ?? 0)));
  const listRef = useRef<HTMLOListElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { enqueue } = useAnalysis();
  const reviewRequested = useRef(false);

  // Analyzed in bulk but not reviewed yet: Arthur writes this game's review now that it's open.
  useEffect(() => {
    if (reviewRequested.current || !data.gameId || data.status !== "tagged") return;
    reviewRequested.current = true;
    enqueue([data.gameId], { front: true });
  }, [data.gameId, data.status, enqueue]);

  const jump = useCallback(
    (ply: number) => {
      const next = Math.max(0, Math.min(plies.length, ply));
      setCurrent(next);
      // Keep the selected move visible by scrolling the move list itself, never the page.
      const list = listRef.current;
      const row = list?.querySelector<HTMLElement>(`[data-ply="${next}"]`)?.closest("li");
      if (list && row) {
        // Measured on screen, so it works however the list is positioned; only scrolls when the row is out of view.
        const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
        if (rr.top < lr.top) list.scrollTop += rr.top - lr.top;
        else if (rr.bottom > lr.bottom) list.scrollTop += rr.bottom - lr.bottom;
      }
    },
    [plies.length],
  );

  // Playback: the game replays move by move, waiting as long as each move really took (or faster).
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1); // 1, 2, 5, 10 = times faster than real; 0 = one move a second
  const [waited, setWaited] = useState(0); // ms since the current move appeared, while playing
  /** Any navigation by you stops the replay. */
  const go = useCallback(
    (ply: number) => {
      setPlaying(false);
      jump(ply);
    },
    [jump],
  );
  const waitFor = useCallback((ms: number | null) => (speed === 0 ? 1000 : Math.max(250, (ms ?? 1000) / speed)), [speed]);
  useEffect(() => {
    const upcoming = plies[current];
    if (!playing || !upcoming) return;
    const wait = waitFor(upcoming.spentMs);
    const started = performance.now();
    const ticker = setInterval(() => setWaited(performance.now() - started), 100);
    const timer = setTimeout(() => {
      setWaited(0);
      jump(current + 1);
      if (current + 1 >= plies.length) setPlaying(false);
    }, wait);
    return () => {
      clearInterval(ticker);
      clearTimeout(timer);
    };
  }, [playing, current, plies, jump, waitFor]);
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    setWaited(0);
    if (current >= plies.length) jump(0);
    setPlaying(true);
  };

  /** "Move 18" in Arthur's text means your 18th move: show it on the board and bring the board into view. */
  const jumpToMove = useCallback(
    (moveNumber: number) => {
      const ply = myColor === "white" ? moveNumber * 2 - 1 : moveNumber * 2;
      go(ply);
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      boardRef.current?.focus({ preventScroll: true });
    },
    [go, myColor],
  );

  const flagged = useMemo(() => plies.filter((p) => p.isMine && p.severity).map((p) => p.ply), [plies]);
  const nextMistake = () => {
    const after = flagged.find((p) => p > current) ?? flagged[0];
    if (after !== undefined) go(after);
  };

  const pos = current > 0 ? plies[current - 1] : undefined;
  const next = plies[current]; // the move actually played from this position

  // "Why is the green arrow best?": fetched on first hover, cached per position.
  const [whyPly, setWhyPly] = useState<number | null>(null);
  const [whyCache, setWhyCache] = useState<Record<number, WhyState>>({});
  const whyInFlight = useRef(new Set<number>());
  const requestWhy = useCallback(
    async (ply: number) => {
      if (!data.gameId || whyInFlight.current.has(ply)) return;
      whyInFlight.current.add(ply);
      try {
        const res = await fetch(`/api/games/${data.gameId}/why-best`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ply }) });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !json.text) throw new Error(json.error ?? "Arthur couldn't explain this one just now.");
        setWhyCache((m) => ({ ...m, [ply]: { text: json.text } }));
      } catch (e) {
        setWhyCache((m) => ({ ...m, [ply]: { error: (e as Error).message } }));
        whyInFlight.current.delete(ply); // allow a retry on the next hover
      }
    },
    [data.gameId],
  );
  const showWhy = useCallback(
    (open: boolean) => {
      if (!open || !next?.bestUci) return setWhyPly(null);
      setWhyPly(next.ply);
      if (!whyCache[next.ply]) void requestWhy(next.ply);
    },
    [next, whyCache, requestWhy],
  );
  const whyOpen = !!next && whyPly === next.ply;
  const fen = pos?.fenAfter ?? startFen;
  const whitePct = pos ? pos.whitePct : null;

  function onBoardKey(e: React.KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => go(current - 1),
      ArrowRight: () => go(current + 1),
      ArrowUp: () => go(0),
      ArrowDown: () => go(plies.length),
      Home: () => go(0),
      End: () => go(plies.length),
      " ": togglePlay,
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  // One row per full move; the severity chip of my move sits in its own column.
  const moveRows = useMemo(() => {
    const rows: { no: number; w?: ReviewPly; b?: ReviewPly }[] = [];
    for (const p of plies) {
      const no = Math.ceil(p.ply / 2);
      const last = rows[rows.length - 1];
      if (p.color === "w") rows.push({ no, w: p });
      else if (last && last.no === no && !last.b) last.b = p;
      else rows.push({ no, b: p });
    }
    return rows;
  }, [plies]);

  const selectedCoach = pos && pos.isMine && pos.severity ? coach[pos.ply] : undefined;

  // Both clocks as they stood at this position: each side's time after its latest move.
  const clocks = useMemo(() => {
    let w = data.startClockMs ?? null, b = data.startClockMs ?? null;
    for (const p of plies.slice(0, current)) {
      if (p.clockMs === null) continue;
      if (p.color === "w") w = p.clockMs;
      else b = p.clockMs;
    }
    return { white: w, black: b, any: plies.some((p) => p.clockMs !== null) };
  }, [plies, current, data.startClockMs]);
  const toMove: "white" | "black" = (pos?.color ?? "b") === "w" ? "black" : "white";
  const theirColor = myColor === "white" ? "black" : "white";
  // While replaying, the clock of the side to move runs down live toward the time it really had after its move.
  const upcoming = plies[current];
  const liveDrop = playing && upcoming?.spentMs ? Math.min(upcoming.spentMs, (waited / waitFor(upcoming.spentMs)) * upcoming.spentMs) : 0;
  const strip = (side: "white" | "black", mine: boolean) => (
    <ClockStrip
      name={mine ? (data.players?.me ?? "You") : (data.players?.opponent ?? "Opponent")}
      clockMs={clocks.any && clocks[side] !== null ? Math.max(0, clocks[side]! - (toMove === side ? liveDrop : 0)) : null}
      active={current < plies.length && toMove === side}
      spentMs={pos && (pos.color === "w") === (side === "white") ? pos.spentMs : null}
    />
  );

  // The graph is in your terms: your winning chances, and the game split into its parts.
  const graphPoints = useMemo(
    () => plies.map((p) => ({ ply: p.ply, myPct: p.whitePct === null ? null : myColor === "white" ? p.whitePct : 100 - p.whitePct, label: p.label, isMine: p.isMine })),
    [plies, myColor],
  );
  const segments = useMemo(
    () => phaseSegments(graphPoints.map((p, i) => ({ ...p, phase: plies[i]!.phase })), { result: data.result, ending: data.ending ?? null }),
    [graphPoints, plies, data.result, data.ending],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {/* Board card: the board, the controls, then the score sheet and counts underneath */}
      <section aria-label="Board" className="card min-w-0 space-y-4 p-4 sm:p-5">
        <div
          ref={boardRef}
          tabIndex={0}
          onKeyDown={onBoardKey}
          aria-label="Game board. Use the arrow keys to step through the game."
          className="rounded-[8px]"
        >
          <div className="mb-2 pl-[22px]">{strip(theirColor, false)}</div>
          <div className="flex gap-2">
            <EvalBar whitePct={whitePct} orientation={myColor} />
            <div className="relative min-w-0 flex-1">
              <Board
                fen={fen}
                orientation={myColor}
                lastMove={pos ? { from: pos.from, to: pos.to } : null}
                badge={pos?.label ? { square: pos.to, label: pos.label } : null}
                arrows={nextArrows(next)}
                label={pos ? `Position after ${moveLabel(pos)}` : "Starting position"}
              />
              {data.gameId && next?.bestUci && (
                <BestMoveHint uci={next.bestUci} orientation={myColor} open={whyOpen} state={whyCache[next.ply]} onHover={showWhy} />
              )}
            </div>
          </div>
          <div className="mt-2 pl-[22px]">{strip(myColor, true)}</div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="First move" onClick={() => go(0)}>
            <NavIcon d="M6 5v14M18 5l-9 7 9 7z" />
          </button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous move" onClick={() => go(current - 1)}>
            <NavIcon d="M15 5l-8 7 8 7z" />
          </button>
          <button
            type="button"
            className={`btn btn-icon ${playing ? "btn-primary" : "btn-secondary"}`}
            aria-label={playing ? "Pause" : "Play the game"}
            aria-pressed={playing}
            onClick={togglePlay}
            disabled={plies.length === 0}
          >
            {playing ? <NavIcon d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <NavIcon d="M8 5l11 7-11 7z" />}
          </button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Next move" onClick={() => go(current + 1)}>
            <NavIcon d="M9 5l8 7-8 7z" />
          </button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Last move" onClick={() => go(plies.length)}>
            <NavIcon d="M18 5v14M6 5l9 7-9 7z" />
          </button>
          <button type="button" className="btn btn-primary" onClick={nextMistake} disabled={flagged.length === 0}>
            Next mistake
          </button>
          <label className="sr-only" htmlFor="play-speed">
            Playback speed
          </label>
          <select id="play-speed" className="select min-h-[44px] rounded-full border-transparent bg-chip text-[0.875rem] font-semibold" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>Real time</option>
            <option value={2}>2× speed</option>
            <option value={5}>5× speed</option>
            <option value={10}>10× speed</option>
            <option value={0}>1 move a second</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <MoveList rows={moveRows} current={current} onSelect={go} listRef={listRef} />
          <MoveCounts counts={data.counts} />
        </div>
      </section>

      {/* Coach, ask and moves column */}
      <div className="min-w-0 space-y-4">
        <ArthurPanel
          onJump={jumpToMove}
          gameId={data.gameId}
          opening={
            data.summary
              ? {
                  text: data.summary.story
                    ? `${data.summary.headline}. ${data.summary.momentum ?? ""}`.trim()
                    : data.summary.overview
                    ? `${data.summary.headline ? `${data.summary.headline}. ` : ""}${data.summary.overview} ${data.summary.work_on}`
                    : `${data.summary.key_moment ?? ""} ${data.summary.work_on}`.trim(),
                  expression: expressionForGame(data.result, data.accuracy, data.summary.verdict),
                }
              : null
          }
          focus={
            pos && (pos.note || (pos.severity && selectedCoach?.explanation))
              ? {
                  text: pos.note ?? selectedCoach!.explanation!,
                  ply: pos.ply,
                  tags: pos.isMine ? pos.tags : [],
                  expression: expressionForMove({
                    label: pos.label,
                    mine: pos.isMine,
                    ply: pos.ply,
                    clockMs: pos.clockMs,
                    missedMate: selectedCoach?.missedMate,
                    winBefore: moverWinBefore(plies, pos),
                  }),
                }
              : null
          }
          ply={current}
          placeholder={
            !data.analyzed
              ? "Give me a minute, I'm still going through this game."
              : data.summary
                ? "Step through the game with me, or ask me anything about it."
                : "I'm writing up my notes on this game."
          }
        />

        {data.summary && <GameSummary summary={data.summary} onJump={jumpToMove} />}

        <CoachCard ply={pos} info={selectedCoach} data={data} />

        <section className="card min-w-0" aria-labelledby="eval-h">
          <h2 id="eval-h" className="mb-3 text-[1.0625rem]">
            How the game went
          </h2>
          <EvalGraph points={graphPoints} segments={segments} current={current} onSelect={go} />
        </section>
      </div>
    </div>
  );
}

type MoveRow = { no: number; w?: ReviewPly; b?: ReviewPly };

/** The score sheet: one row per full move, the label icon beside each move, scrolling inside its own panel. */
function MoveList({ rows, current, onSelect, listRef }: { rows: MoveRow[]; current: number; onSelect: (ply: number) => void; listRef: React.RefObject<HTMLOListElement | null> }) {
  // One gold highlight that glides to the selected move instead of jumping.
  const glideRef = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const glide = glideRef.current;
    const btn = listRef.current?.querySelector<HTMLElement>(`[data-ply="${current}"]`);
    if (!glide) return;
    if (!btn) {
      glide.style.opacity = "0";
      return;
    }
    glide.style.opacity = "1";
    glide.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    glide.style.width = `${btn.offsetWidth}px`;
    glide.style.height = `${btn.offsetHeight}px`;
  }, [current, rows, listRef]);
  return (
    <section className="panel-data min-w-0" aria-labelledby="moves-h">
      <h2 id="moves-h" className="label-data mb-1.5">
        Moves
      </h2>
      <ol ref={listRef} className="no-scrollbar mono relative max-h-[360px] overflow-y-auto text-[0.9375rem]">
        <li ref={glideRef} aria-hidden="true" className="glide pointer-events-none absolute left-0 top-0 rounded-[4px] bg-gold opacity-0" />
        {rows.map((row) => {
          const blunder = row.w?.isMine ? row.w.severity === "blunder" : row.b?.isMine ? row.b.severity === "blunder" : false;
          return (
            <li key={row.no} className={`grid grid-cols-[1.75rem_1fr_1fr] items-center gap-1 rounded-[4px] px-1.5 ${blunder ? "row-tint" : ""}`}>
              <span className="text-muted">{row.no}</span>
              <MoveCell p={row.w} current={current} onSelect={onSelect} />
              <MoveCell p={row.b} current={current} onSelect={onSelect} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MoveCell({ p, current, onSelect }: { p?: ReviewPly; current: number; onSelect: (ply: number) => void }) {
  if (!p) return <span />;
  const active = p.ply === current;
  return (
    <button
      type="button"
      data-ply={p.ply}
      onClick={() => onSelect(p.ply)}
      aria-current={active ? "step" : undefined}
      className={`relative z-10 inline-flex min-h-[30px] items-center justify-self-start rounded-[4px] px-1.5 text-left transition-colors ${active ? "text-[color:var(--on-gold)]" : "text-ink hover:bg-chip"}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {p.label && p.label !== "good" && p.label !== "excellent" ? <MoveIcon label={p.label} size={20} /> : <span className="inline-block h-5 w-5" aria-hidden="true" />}
        {p.san}
      </span>
    </button>
  );
}

/** chess.com's review tally: every label with your count (gold) and your opponent's. */
function MoveCounts({ counts }: { counts: ReviewData["counts"] }) {
  return (
    <section className="panel-data min-w-0" aria-labelledby="counts-h">
      <h2 id="counts-h" className="label-data mb-1.5">
        Counts · you / them
      </h2>
      {counts ? (
        <table className="mono w-full text-[0.9375rem]">
          <thead className="sr-only">
            <tr>
              <th scope="col">Label</th>
              <th scope="col">You</th>
              <th scope="col">Them</th>
            </tr>
          </thead>
          <tbody>
            {MOVE_LABELS.map((l) => (
              <tr key={l.id}>
                <th scope="row" className="py-[3px] text-left font-semibold text-body2">
                  <span className="inline-flex items-center gap-2">
                    <MoveIcon label={l.id} size={21} />
                    {l.name}
                  </span>
                </th>
                <td className="w-8 text-right text-gold">
                  <CountUp to={counts.me[l.id]} />
                </td>
                <td className="w-8 text-right text-muted">
                  <CountUp to={counts.opponent[l.id]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted">Counts appear once the engine has been through the game.</p>
      )}
    </section>
  );
}

function CoachCard({ ply, info, data }: { ply?: ReviewPly; info?: CoachInfo; data: ReviewData }) {
  if (!data.analyzed && data.gameId) {
    return (
      <section className="card p-6" aria-label="Analysis">
        <AnalysisProgress gameId={data.gameId} status={data.status} error={data.error} />
      </section>
    );
  }
  if (!data.analyzed) {
    return (
      <section className="card p-6" aria-labelledby="coach-h">
        <h2 id="coach-h" className="text-xl">
          Not analyzed yet
        </h2>
        <p className="mt-2 text-body2">
          Once the engine has been through this game, each flagged move shows up here with the coach&apos;s explanation,
          the engine&apos;s preferred move, tags, and a related lesson.
        </p>
      </section>
    );
  }
  if (!ply || !ply.isMine || !ply.severity) {
    if (data.summary) return null; // Arthur's panel already guides you
    return (
      <section className="card p-6" aria-labelledby="coach-h">
        <h2 id="coach-h" className="text-xl">
          Pick a flagged move
        </h2>
        <p className="mt-2 text-body2">Use Next mistake, or click a move with a chip or a marker on the graph.</p>
      </section>
    );
  }
  return (
    <section className="card p-6" aria-labelledby="coach-h">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="coach-h" className="text-xl">
          Move {Math.ceil(ply.ply / 2)}
        </h2>
        <SeverityChip severity={ply.severity} />
        {info?.winBefore !== null && info?.winBefore !== undefined && info.winAfter !== null && (
          <span className="text-sm text-body2">
            Your winning chances: <span className="mono text-ink">{info.winBefore}%</span> → <span className="mono text-ink">{info.winAfter}%</span>
          </span>
        )}
      </div>
      {data.analyzed && !ply.note && !info?.explanation && data.status !== "reviewed" && (
        <p className="mt-3 text-sm text-muted">Arthur is still writing his notes on this move.</p>
      )}
      {info?.missedMate && <p className="mt-3 text-sm font-semibold text-ink">You had a forced checkmate here.</p>}
      {ply.bestUci && ply.bestUci !== `${ply.from}${ply.to}` && (
        <p className="mt-3 flex items-center gap-2 text-sm text-body2">
          <span className="inline-block h-1.5 w-6 rounded-full" style={{ background: BEST_ARROW }} aria-hidden="true" />
          Step back one move to compare: yellow is what was played, green is what the engine wanted.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-line-soft pt-3 text-sm text-body2">
        {info?.maiaLine && (
          <span>
            <span className="font-semibold text-ink">Players at your level:</span> {info.maiaLine}
          </span>
        )}
        <span>
          <span className="font-semibold text-ink">Clock:</span> <span className="mono">{formatClock(ply.clockMs)}</span> left
        </span>
      </div>
      {info?.relatedLesson && (
        <p className="mt-3 text-sm">
          <Link className="arrow-link font-normal" href={info.relatedLesson.href}>
            Related lesson: “{info.relatedLesson.title}” →
          </Link>
        </p>
      )}
    </section>
  );
}

const NEXT_ARROW = "rgba(246, 190, 40, 0.9)";
const BEST_ARROW = "rgba(76, 175, 80, 0.9)";

/** From the position on the board: yellow for the move actually played next, green for the engine's best move here. */
function nextArrows(next: ReviewPly | undefined) {
  if (!next) return [];
  const played = `${next.from}${next.to}`;
  const best = next.bestUci && next.bestUci.slice(0, 4) !== played ? next.bestUci : null;
  const arrows = [{ startSquare: next.from, endSquare: next.to, color: next.bestUci?.slice(0, 4) === played ? BEST_ARROW : NEXT_ARROW }];
  if (best) arrows.push({ startSquare: best.slice(0, 2), endSquare: best.slice(2, 4), color: BEST_ARROW });
  return arrows;
}

type WhyState = { text?: string; error?: string };

/** Centre of a square in percent of the board, from the viewer's side. */
function squareCenter(sq: string, orientation: "white" | "black") {
  const file = sq.charCodeAt(0) - 97, rank = Number(sq[1]);
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
}

/**
 * Hovering the green arrow asks Arthur why it is the best move. An invisible, wide
 * stroke along the arrow catches the pointer; the answer floats beside the arrow.
 */
function BestMoveHint({ uci, orientation, open, state, onHover }: { uci: string; orientation: "white" | "black"; open: boolean; state?: WhyState; onHover: (open: boolean) => void }) {
  const a = squareCenter(uci.slice(0, 2), orientation), b = squareCenter(uci.slice(2, 4), orientation);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const above = mid.y > 45;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="transparent"
          strokeWidth="7"
          strokeLinecap="round"
          className="pointer-events-auto cursor-help"
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        />
      </svg>
      {open && (
        <div
          role="tooltip"
          id="why-best"
          className="absolute w-[min(320px,80%)] -translate-x-1/2 rounded-[12px] border border-[color:var(--good-line)] bg-[#0b1f17]/95 px-4 py-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          style={{ left: `${Math.min(78, Math.max(22, mid.x))}%`, ...(above ? { bottom: `${100 - mid.y + 7}%` } : { top: `${mid.y + 7}%` }) }}
        >
          <p className="label-data mb-1 text-good">Why this is the best move</p>
          <p className="text-[0.9375rem] leading-snug text-ink">
            {state?.text ?? (state?.error ? <span className="text-muted">{state.error}</span> : <Shimmer lines={2} label="Arthur is looking at it" />)}
          </p>
        </div>
      )}
    </div>
  );
}

function clockText(ms: number): string {
  if (ms < 20_000) return `0:${(ms / 1000).toFixed(1).padStart(4, "0")}`; // tenths when it's tight
  return formatClock(ms);
}

function spentText(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** A player's name with their clock at this position, chess.com style; the side to move is lit up. */
function ClockStrip({ name, clockMs, active, spentMs }: { name: string; clockMs: number | null; active: boolean; spentMs: number | null }) {
  const low = clockMs !== null && clockMs < 60_000;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-semibold text-ink">{name}</span>
        {spentMs !== null && spentMs >= 1000 && <span className="mono shrink-0 text-[0.8125rem] text-muted">took {spentText(spentMs)}</span>}
      </span>
      {clockMs !== null && (
        <span
          className={`mono flex min-w-[112px] items-center justify-end gap-2 rounded-[6px] px-3 py-1 text-[1.375rem] leading-none transition-colors ${
            active ? (low ? "bg-[color:var(--loss)] text-[#2a0805]" : "bg-gold text-[color:var(--on-gold)]") : low ? "bg-chip text-[color:var(--loss)]" : "bg-chip text-ink"
          }`}
          aria-label={`${name}'s clock: ${formatClock(clockMs)}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className={active ? "opacity-90" : "opacity-50"}>
            <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M12 9v4.5l2.8 1.7M9.5 2.5h5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          {clockText(clockMs)}
        </span>
      )}
    </div>
  );
}

/** The mover's win% in the position before this move (from stored White win%). */
function moverWinBefore(plies: ReviewPly[], p: ReviewPly): number | null {
  const prev = p.ply > 1 ? plies[p.ply - 2]?.whitePct : 50;
  if (prev === null || prev === undefined) return null;
  return p.color === "w" ? prev : 100 - prev;
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
