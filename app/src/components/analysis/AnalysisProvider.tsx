"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { runEngineAnalysis } from "@/lib/analysis/runGame";
import { getEngine } from "@/lib/engine/stockfish";
import { MAIA_MODEL, maiaPredict } from "@/lib/maia/browser";

/**
 * Browser-side analysis queue. Runs Stockfish (WASM, in a Web Worker) and
 * Maia (ONNX, WASM) over FINISHED games one at a time while a Nimzo tab is
 * open, and drives the server steps. Never touches live chess.com games.
 */

export type JobState = {
  state: "queued" | "analyzing" | "saving" | "maia" | "tagging" | "done" | "failed";
  progress: number;
  error?: string;
};

type Ctx = {
  jobs: Record<string, JobState>;
  current: string | null;
  queueLength: number;
  backlog: number;
  enqueue: (ids: string[], opts?: { front?: boolean; force?: boolean }) => void;
  analyzeBacklog: () => Promise<void>;
  retry: (id: string) => Promise<void>;
};

const AnalysisContext = createContext<Ctx | null>(null);

export function useAnalysis(): Ctx {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis outside AnalysisProvider");
  return ctx;
}

type GameInfo = { id: string; pgn: string; my_color: "white" | "black"; analysis_status: string };

export function AnalysisProvider({ children, depth, autoRecent }: { children: React.ReactNode; depth: number; autoRecent: number }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const [queueLength, setQueueLength] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [backlog, setBacklog] = useState(0);
  const queueRef = useRef<{ id: string; force: boolean }[]>([]);
  const running = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setJob = useCallback((id: string, patch: Partial<JobState>) => {
    setJobs((j) => ({ ...j, [id]: { state: "queued", progress: 0, ...j[id], ...patch } }));
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  const post = async (url: string, body?: unknown) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((json as { error?: string }).error ?? `${url} failed (${r.status})`);
    return json;
  };

  /**
   * Resumable pipeline for one game, picking up from its stored status:
   * imported -> engine (+ facts on the server) -> Maia (here) -> Jev tagging (server) -> tagged.
   */
  const analyzeOne = useCallback(
    async (next: { id: string; force: boolean }) => {
      const id = next.id;
      try {
        const res = await fetch(`/api/games/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Couldn't load game (${res.status})`);
        const game = (await res.json()) as GameInfo;
        let status = next.force ? "imported" : game.analysis_status;
        if (!["imported", "engine_done", "facts_done"].includes(status)) {
          setJob(id, { state: "done", progress: 1 });
          return;
        }

        if (status === "imported") {
          setJob(id, { state: "analyzing", progress: 0 });
          const engine = getEngine();
          engine.newGame();
          const payload = await runEngineAnalysis({
            pgn: game.pgn,
            myColor: game.my_color,
            engine,
            depth,
            onProgress: (done, total) => setJob(id, { progress: Math.min(0.85, (done / total) * 0.85) }),
          });
          setJob(id, { state: "saving", progress: 0.86 });
          await post(`/api/games/${id}/engine`, payload); // also runs the facts step
          status = "facts_done";
          scheduleRefresh();
        } else if (status === "engine_done") {
          await post(`/api/games/${id}/facts`);
          status = "facts_done";
        }

        // Maia: how likely a player at your level is to play each flagged move. Best effort.
        setJob(id, { state: "maia", progress: 0.88 });
        try {
          const { elo, items } = (await (await fetch(`/api/games/${id}/maia`, { cache: "no-store" })).json()) as {
            elo: number;
            items: { ply: number; fen_before: string; played_uci: string; best_uci: string | null }[];
          };
          if (items.length) {
            const out = [];
            for (const it of items) {
              const r = await maiaPredict(it.fen_before, elo);
              out.push({
                ply: it.ply,
                p_played: r.policy[it.played_uci] ?? 0,
                p_best: it.best_uci ? (r.policy[it.best_uci] ?? 0) : null,
                top: Object.entries(r.policy).slice(0, 5).map(([uci, p]) => ({ uci, p })),
              });
            }
            await post(`/api/games/${id}/maia`, { model: MAIA_MODEL, elo, items: out });
          }
        } catch (e) {
          console.warn("[maia] skipped:", (e as Error).message);
        }

        setJob(id, { state: "tagging", progress: 0.94 });
        await post(`/api/games/${id}/tag`);
        setJob(id, { state: "done", progress: 1 });
        setBacklog((b) => Math.max(0, b - 1));
      } catch (e) {
        const message = (e as Error).message || "Analysis failed";
        setJob(id, { state: "failed", error: message });
        await fetch(`/api/games/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fail", error: message }),
        }).catch(() => undefined);
      } finally {
        scheduleRefresh();
      }
    },
    [depth, setJob, scheduleRefresh],
  );

  // One game at a time; started by enqueue, stops when the queue is empty.
  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queueRef.current.length) {
        const next = queueRef.current.shift()!;
        setQueueLength(queueRef.current.length);
        setCurrent(next.id);
        await analyzeOne(next);
      }
    } finally {
      running.current = false;
      setCurrent(null);
    }
  }, [analyzeOne]);

  const enqueue = useCallback<Ctx["enqueue"]>(
    (ids, opts) => {
      if (!ids.length) return;
      const rest = queueRef.current.filter((x) => !ids.includes(x.id));
      const added = ids.map((id) => ({ id, force: !!opts?.force }));
      queueRef.current = opts?.front ? [...added, ...rest] : [...rest, ...added];
      setQueueLength(queueRef.current.length);
      for (const id of ids) setJob(id, { state: "queued", progress: 0, error: undefined });
      void pump();
    },
    [pump, setJob],
  );

  // On load: auto-analyze the most recent games that haven't been analyzed yet.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analysis/pending?recent=${autoRecent}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ids: string[]; backlog: number }) => {
        if (cancelled) return;
        setBacklog(d.backlog);
        enqueue(d.ids);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [autoRecent, enqueue]);

  const analyzeBacklog = useCallback(async () => {
    const d = (await fetch("/api/analysis/pending", { cache: "no-store" }).then((r) => r.json())) as { ids: string[]; backlog: number };
    setBacklog(d.backlog);
    enqueue(d.ids);
  }, [enqueue]);

  const retry = useCallback(
    async (id: string) => {
      await fetch(`/api/games/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      enqueue([id], { front: true });
    },
    [enqueue],
  );

  const value = useMemo<Ctx>(
    () => ({ jobs, current, queueLength, backlog, enqueue, analyzeBacklog, retry }),
    [jobs, current, queueLength, backlog, enqueue, analyzeBacklog, retry],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

/** Small status line for the nav: "Analyzing 1 of 4 · 38%". */
export function AnalysisStatus() {
  const { current, jobs, queueLength } = useAnalysis();
  if (!current) return null;
  const job = jobs[current];
  return (
    <span className="mono text-[0.75rem] text-muted" role="status">
      Analyzing{queueLength ? ` · ${queueLength} queued` : ""} · {Math.round((job?.progress ?? 0) * 100)}%
    </span>
  );
}
