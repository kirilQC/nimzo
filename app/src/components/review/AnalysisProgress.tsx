"use client";

import { useEffect, useRef } from "react";
import { useAnalysis } from "@/components/analysis/AnalysisProvider";

/** Shown on an unanalyzed game: queues it first and reports progress, or offers a retry if it failed. */
export function AnalysisProgress({ gameId, status, error }: { gameId: string; status: string; error: string | null }) {
  const { jobs, enqueue, retry, current } = useAnalysis();
  const job = jobs[gameId];
  const started = useRef(false);

  useEffect(() => {
    if (started.current || status !== "imported") return;
    started.current = true;
    enqueue([gameId], { front: true });
  }, [gameId, status, enqueue]);

  const failed = job?.state === "failed" || (status === "failed" && job?.state !== "queued" && job?.state !== "analyzing");
  if (failed) {
    return (
      <div>
        <h2 className="text-xl">Analysis failed</h2>
        <p className="mt-2 text-sm text-body2">{job?.error ?? error ?? "Something went wrong while analyzing this game."}</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => void retry(gameId)}>
          Retry analysis
        </button>
      </div>
    );
  }

  const pct = Math.round((job?.progress ?? 0) * 100);
  const waiting = job?.state === "queued" && current !== gameId;
  return (
    <div>
      <h2 className="text-xl">{waiting ? "Waiting for the engine" : "Analyzing with Stockfish"}</h2>
      <p className="mt-2 text-sm text-body2">
        {waiting
          ? "Another game is being analyzed first. This one is next."
          : "Every position is checked at depth 16 in your browser. Keep this tab open; it takes under a minute."}
      </p>
      <div className="mt-4 h-2 rounded-full bg-chip" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Analysis progress">
        <div className="h-full rounded-full bg-walnut transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mono mt-1 text-right text-xs text-muted">{pct}%</p>
    </div>
  );
}
