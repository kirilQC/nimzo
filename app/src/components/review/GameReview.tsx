"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnalysis } from "@/components/analysis/AnalysisProvider";
import { Board } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { EvalGraph } from "@/components/board/EvalGraph";
import { SeverityChip, type Severity } from "@/components/ui";
import { MoveIcon } from "@/components/board/MoveIcon";
import { MOVE_LABELS, type LabelId } from "@/lib/analysis/labels";
import { formatClock } from "@/lib/chess/pgn";
import { AnalysisProgress } from "./AnalysisProgress";
import { ArthurPanel } from "@/components/coach/ArthurPanel";
import { GameSummary } from "./GameSummary";
import { expressionForGame, expressionForMove } from "@/lib/coach/expressions";

export type ReviewPly = {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenAfter: string;
  clockMs: number | null;
  isMine: boolean;
  severity: Severity | null;
  label: LabelId | null;
  note: string | null; // Arthur's one plain sentence about this move
  tags: { id: string; label: string; polarity: "good" | "bad" }[]; // what happened on this move (rule + Jev)
  bestUci: string | null; // engine's move in the position before this one
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

  const go = useCallback(
    (ply: number) => {
      const next = Math.max(0, Math.min(plies.length, ply));
      setCurrent(next);
      // Keep the selected move visible by scrolling the move list itself, never the page.
      const list = listRef.current;
      const row = list?.querySelector<HTMLElement>(`[data-ply="${next}"]`)?.closest("li");
      if (list && row) {
        const top = row.offsetTop - list.offsetTop;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight;
      }
    },
    [plies.length],
  );

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
          <div className="flex gap-2">
            <EvalBar whitePct={whitePct} orientation={myColor} />
            <div className="min-w-0 flex-1">
              <Board
                fen={fen}
                orientation={myColor}
                lastMove={pos ? { from: pos.from, to: pos.to } : null}
                badge={pos?.label ? { square: pos.to, label: pos.label } : null}
                arrows={nextArrows(next)}
                label={pos ? `Position after ${moveLabel(pos)}` : "Starting position"}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="First move" onClick={() => go(0)}>
            <NavIcon d="M6 5v14M18 5l-9 7 9 7z" />
          </button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous move" onClick={() => go(current - 1)}>
            <NavIcon d="M15 5l-8 7 8 7z" />
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
        </div>
        <ArrowLegend next={next} />

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

        <section className="card" aria-labelledby="eval-h">
          <h2 id="eval-h" className="mb-3 text-[0.9375rem]">
            How the game went
          </h2>
          <EvalGraph
            points={plies.map((p) => ({ ply: p.ply, whitePct: p.whitePct, severity: p.severity, isMine: p.isMine }))}
            current={current}
            onSelect={go}
          />
        </section>

      </div>
    </div>
  );
}

type MoveRow = { no: number; w?: ReviewPly; b?: ReviewPly };

/** The score sheet: one row per full move, the label icon beside each move, scrolling inside its own panel. */
function MoveList({ rows, current, onSelect, listRef }: { rows: MoveRow[]; current: number; onSelect: (ply: number) => void; listRef: React.RefObject<HTMLOListElement | null> }) {
  return (
    <section className="panel-data min-w-0" aria-labelledby="moves-h">
      <h2 id="moves-h" className="label-data mb-1.5">
        Moves
      </h2>
      <ol ref={listRef} className="mono max-h-[360px] overflow-y-auto text-[0.9375rem]">
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
      className={`inline-flex min-h-[30px] items-center justify-self-start rounded-[4px] px-1.5 text-left ${active ? "bg-gold text-[color:var(--on-gold)]" : "text-ink hover:bg-chip"}`}
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
                <td className="w-8 text-right text-gold">{counts.me[l.id]}</td>
                <td className="w-8 text-right text-muted">{counts.opponent[l.id]}</td>
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

function ArrowLegend({ next }: { next: ReviewPly | undefined }) {
  if (!next) return null;
  const matched = next.bestUci?.slice(0, 4) === `${next.from}${next.to}`;
  const who = next.isMine ? "You" : "They";
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[0.8125rem] text-body2" aria-live="polite">
      {matched ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-1.5 w-6 rounded-full" style={{ background: BEST_ARROW }} aria-hidden="true" />
          {who} played the engine&apos;s best move next: <span className="mono text-ink">{next.san}</span>
        </span>
      ) : (
        <>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-6 rounded-full" style={{ background: NEXT_ARROW }} aria-hidden="true" />
            {who} played next: <span className="mono text-ink">{next.san}</span>
          </span>
          {next.bestUci && (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-6 rounded-full" style={{ background: BEST_ARROW }} aria-hidden="true" />
              Engine&apos;s best move here
            </span>
          )}
        </>
      )}
    </p>
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
