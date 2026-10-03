"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/Board";
import { EvalBar } from "@/components/board/EvalBar";
import { EvalGraph } from "@/components/board/EvalGraph";
import { SeverityChip, type Severity } from "@/components/ui";
import { formatClock } from "@/lib/chess/pgn";

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
  whitePct: number | null;
};

export type CoachInfo = {
  ply: number;
  explanation: string | null;
  bestMoveSan: string | null;
  bestMoveEval: string | null;
  bestMoveNote: string | null;
  evalBefore: string | null;
  evalAfter: string | null;
  tags: { id: string; label: string; confidence: number | null }[];
  maiaLine: string | null;
  relatedLesson: { href: string; title: string } | null;
};

export type ReviewData = {
  startFen: string;
  myColor: "white" | "black";
  plies: ReviewPly[];
  coach: Record<number, CoachInfo>;
  analyzed: boolean;
};

const SUFFIX: Record<Severity, string> = { blunder: "??", mistake: "?", inaccuracy: "?!" };

function moveLabel(p: { ply: number; color: "w" | "b"; san: string }, suffix = "") {
  return `${Math.ceil(p.ply / 2)}${p.color === "w" ? "." : "..."} ${p.san}${suffix}`;
}

export function GameReview({ data }: { data: ReviewData }) {
  const { plies, startFen, myColor, coach } = data;
  const firstFlag = plies.find((p) => p.isMine && p.severity)?.ply;
  const [current, setCurrent] = useState<number>(firstFlag ?? 0);
  const listRef = useRef<HTMLOListElement>(null);

  const go = useCallback(
    (ply: number) => {
      const next = Math.max(0, Math.min(plies.length, ply));
      setCurrent(next);
      listRef.current?.querySelector(`[data-ply="${next}"]`)?.scrollIntoView({ block: "nearest" });
    },
    [plies.length],
  );

  const flagged = useMemo(() => plies.filter((p) => p.isMine && p.severity).map((p) => p.ply), [plies]);
  const nextMistake = () => {
    const after = flagged.find((p) => p > current) ?? flagged[0];
    if (after !== undefined) go(after);
  };

  const pos = current > 0 ? plies[current - 1] : undefined;
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[480px_minmax(0,1fr)]">
      {/* Board column */}
      <div className="min-w-0 space-y-4">
        <div
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

        <section className="card" aria-labelledby="eval-h">
          <h2 id="eval-h" className="eyebrow mb-3">
            Evaluation
          </h2>
          <EvalGraph
            points={plies.map((p) => ({ ply: p.ply, whitePct: p.whitePct, severity: p.severity, isMine: p.isMine }))}
            current={current}
            onSelect={go}
          />
        </section>
      </div>

      {/* Coach, ask and moves column */}
      <div className="min-w-0 space-y-4">
        <CoachCard ply={pos} info={selectedCoach} analyzed={data.analyzed} />

        <form className="card" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="ask-game" className="mb-2 block text-sm font-semibold text-ink">
            Ask the coach about this game
          </label>
          <div className="flex gap-2">
            <input
              id="ask-game"
              className="input"
              placeholder={flagged[0] ? `Why was ${moveLabel(plies[flagged[0] - 1]!)} a mistake?` : "Ask about a move or a plan"}
              disabled
            />
            <button type="submit" className="btn btn-primary" disabled>
              Ask
            </button>
          </div>
        </form>

        <section className="card px-0 pb-2" aria-labelledby="moves-h">
          <h2 id="moves-h" className="eyebrow mb-2 px-5">
            Moves
          </h2>
          <ol ref={listRef} className="max-h-[420px] overflow-y-auto">
            {moveRows.map((row) => {
              const mine = myColor === "white" ? row.w : row.b;
              const sev = mine?.isMine ? mine.severity : null;
              return (
                <li
                  key={row.no}
                  className={`grid grid-cols-[2.75rem_1fr_1fr_6.5rem] items-center gap-1 border-t border-line-soft px-5 py-0.5 first:border-t-0 ${
                    sev === "blunder" ? "row-tint" : ""
                  }`}
                >
                  <span className="mono text-sm text-muted">{row.no}.</span>
                  <MoveCell p={row.w} current={current} onSelect={go} />
                  <MoveCell p={row.b} current={current} onSelect={go} />
                  <span className="text-right">{sev && <SeverityChip severity={sev} />}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
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
      className={`mono min-h-[34px] justify-self-start rounded-[6px] px-2 text-left text-[0.9375rem] ${
        active ? "bg-chip text-ink" : "text-body2 hover:bg-chip/60"
      }`}
    >
      {p.san}
    </button>
  );
}

function CoachCard({ ply, info, analyzed }: { ply?: ReviewPly; info?: CoachInfo; analyzed: boolean }) {
  if (!analyzed) {
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
        <h2 id="coach-h" className="mono text-xl font-medium">
          {moveLabel(ply, SUFFIX[ply.severity])}
        </h2>
        <SeverityChip severity={ply.severity} />
        {info?.evalBefore && info.evalAfter && (
          <span className="mono text-sm text-muted">
            {info.evalBefore} → {info.evalAfter}
          </span>
        )}
      </div>
      <p className="serif mt-3 text-[1.0625rem] leading-relaxed text-ink">
        {info?.explanation ?? "The coach's explanation appears here once this move has been reviewed."}
      </p>
      {info?.bestMoveSan && (
        <p className="mt-3 text-sm text-body2">
          The engine preferred <span className="mono font-medium text-ink">{info.bestMoveSan}</span>
          {info.bestMoveEval && <span className="mono"> ({info.bestMoveEval})</span>}
          {info.bestMoveNote && <>: {info.bestMoveNote}</>}
        </p>
      )}
      {info && info.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
          {info.tags.map((t) => (
            <li key={t.id} className="chip font-normal">
              {t.label}
              {t.confidence !== null && <span className="mono"> · {t.confidence.toFixed(2)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-line-soft pt-3 text-sm text-body2">
        {info?.maiaLine && (
          <span>
            <span className="font-semibold text-ink">Maia check:</span> {info.maiaLine}
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

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
