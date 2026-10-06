"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SeverityChip, type Severity } from "@/components/ui";
import { useAnalysis, type JobState } from "@/components/analysis/AnalysisProvider";
import { loadMaia } from "@/lib/maia/browser";

// FAIR PLAY: Session mode only polls Nimzo's own /api/sync, which imports
// FINISHED games from chess.com's public archives. Nothing here reads a live
// game or gives feedback while a chess.com game is in progress.

export type SessionInfo = { id: string; started_at: string; last_activity_at: string };

export type SessionGame = {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  time_control: string | null;
  end_time: string;
  analysis_status: string;
  blunders: number | null;
  mistakes: number | null;
  inaccuracies: number | null;
};

const POLL_MS = 60_000;
const RESUME_WINDOW_MS = 150_000; // a refresh within 2.5 min resumes; a closed tab counts as off
const STORAGE_KEY = "nimzo.session";

const RESULT = { win: "Win", loss: "Loss", draw: "Draw" } as const;

function tcLabel(tc: string | null): string {
  const m = tc ? /^(\d+)(?:\+(\d+))?$/.exec(tc) : null;
  if (!m) return tc ?? "";
  return `${Math.round(Number(m[1]) / 60)}${m[2] ? `+${m[2]}` : ""} min`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
}

// Syncing -> Analyzing -> Ready, combining the stored status with the live browser job.
function statusLabel(g: SessionGame, job: JobState | undefined): string {
  if (job?.state === "analyzing" || job?.state === "saving") return `Analyzing · ${Math.round(job.progress * 100)}%`;
  if (job?.state === "queued") return "Waiting to analyze";
  if (job?.state === "failed" || g.analysis_status === "failed") return "Analysis failed";
  if (g.analysis_status === "imported") return "Waiting to analyze";
  return `Ready · ${timeAgo(g.end_time)}`;
}

function readStored(): { id: string; heartbeat: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { id: string; heartbeat: number }) : null;
  } catch {
    return null;
  }
}

function writeStored(v: { id: string; heartbeat: number } | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable: resume-on-refresh just won't work
  }
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

type SyncResponse = { imported: number; newGameIds: string[]; latestGameId: string | null; sessionGames?: SessionGame[] };

export function SessionCard({
  openSession,
  openSessionGames,
  needsBackfill,
  autoOffMinutes,
  backfillMonths,
}: {
  openSession: SessionInfo | null;
  openSessionGames: SessionGame[];
  needsBackfill: boolean;
  autoOffMinutes: number;
  backfillMonths: number;
}) {
  const labelId = useId();
  const router = useRouter();
  const analysis = useAnalysis();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [games, setGames] = useState<SessionGame[]>([]);
  const [leftOpen, setLeftOpen] = useState<SessionInfo | null>(null); // open row from a closed tab
  const [busy, setBusy] = useState<null | "starting" | "ending" | "analyzing" | "backfill">(needsBackfill ? "backfill" : null);
  const [syncing, setSyncing] = useState(false);
  const [engine, setEngine] = useState<null | "waking" | "awake" | "error">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastNewAt = useRef<number>(0);
  const inFlight = useRef(false);
  const on = session !== null;

  // On load: resume after a quick refresh, otherwise treat the open row as a closed tab.
  // localStorage only exists in the browser, so this decision has to happen after mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!openSession) return;
    const stored = readStored();
    if (stored?.id === openSession.id && Date.now() - stored.heartbeat < RESUME_WINDOW_MS) {
      setSession(openSession);
      setGames(openSessionGames);
      lastNewAt.current = new Date(openSession.last_activity_at).getTime();
    } else {
      setLeftOpen(openSession);
    }
  }, [openSession, openSessionGames]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sync = useCallback(
    async (sessionId: string | null): Promise<SyncResponse | null> => {
      if (inFlight.current) return null; // one sync at a time; chess.com wants serial requests
      inFlight.current = true;
      setSyncing(true);
      try {
        const res = await postJson<SyncResponse>("/api/sync", { sessionId });
        setError(null);
        if (res.sessionGames) setGames(res.sessionGames);
        if (res.newGameIds.length) {
          lastNewAt.current = Date.now();
          // Auto-analyze new finished games right away, ahead of any backlog.
          if (sessionId) analysis.enqueue(res.newGameIds, { front: true });
          router.refresh();
        }
        return res;
      } catch (e) {
        setError(`Couldn't reach chess.com: ${(e as Error).message}`);
        return null;
      } finally {
        inFlight.current = false;
        setSyncing(false);
      }
    },
    [router, analysis],
  );

  // First visit: import the last few months. Runs once per mount; the
  // router.refresh() it triggers flips needsBackfill, which must not cancel it.
  const backfillStarted = useRef(false);
  useEffect(() => {
    if (!needsBackfill || backfillStarted.current) return;
    backfillStarted.current = true;
    void sync(null).then((res) => {
      setBusy((b) => (b === "backfill" ? null : b));
      if (res) setMessage(`Imported ${res.imported} games from chess.com.`);
    });
  }, [needsBackfill, sync]);

  const end = useCallback(
    async (id: string, reason: "manual" | "auto_off" | "tab_closed", goToSummary: boolean) => {
      setBusy("ending");
      try {
        await postJson("/api/session", { action: "end", id, reason });
        writeStored(null);
        setSession(null);
        setLeftOpen(null);
        setEngine(null);
        if (goToSummary) router.push(`/sessions/${id}`);
        else {
          setMessage(reason === "auto_off" ? `Session turned off after ${autoOffMinutes} minutes without a new game.` : "Session ended.");
          router.refresh();
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [autoOffMinutes, router],
  );

  // Polling loop while the session is on and this tab is open.
  useEffect(() => {
    if (!session) return;
    const tick = async () => {
      writeStored({ id: session.id, heartbeat: Date.now() });
      if (Date.now() - lastNewAt.current > autoOffMinutes * 60_000) {
        await end(session.id, "auto_off", false);
        return;
      }
      await sync(session.id);
    };
    writeStored({ id: session.id, heartbeat: Date.now() });
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [session, autoOffMinutes, sync, end]);

  async function turnOn() {
    setBusy("starting");
    setError(null);
    setMessage(null);
    try {
      const { session: s } = await postJson<{ session: SessionInfo }>("/api/session", { action: "start" });
      lastNewAt.current = Date.now();
      setLeftOpen(null);
      setGames([]);
      setSession(s);
      // Load Maia in the browser now so it's ready by the time the first game ends.
      setEngine("waking");
      loadMaia()
        .then(() => setEngine("awake"))
        .catch(() => setEngine("error"));
      await sync(s.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function analyzeLast() {
    setBusy("analyzing");
    const res = await sync(session?.id ?? null);
    setBusy(null);
    if (res?.latestGameId) router.push(`/games/${res.latestGameId}`);
    else if (res) setMessage("No finished games found on chess.com yet.");
  }

  const endTarget = session ?? leftOpen;
  const kicker = on ? "Session mode is on" : busy === "backfill" ? "Importing your games" : "Session mode is off";
  const statusLine = on
    ? `Checking chess.com every 60 seconds for finished games${session ? ` · since ${new Date(session.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`
    : busy === "backfill"
      ? `Importing your last ${backfillMonths} months from chess.com…`
      : "Turn it on before you play. Every finished game gets analyzed the moment it ends.";

  return (
    <section className="flex flex-col items-center px-4 pb-4 pt-10 text-center" aria-labelledby={labelId}>
      <p className="label-data tracking-[0.3em]">{kicker}</p>
      <h1 id={labelId} className="mt-3 font-[family-name:var(--font-display)] text-[clamp(3.5rem,8vw,7rem)] font-normal leading-none tracking-normal">
        {on ? (
          <>
            Go <em className="text-gold">play.</em>
          </>
        ) : (
          <>
            Shall we <em className="text-gold">play?</em>
          </>
        )}
      </h1>
      <p className="mt-4 max-w-[560px] text-[0.9375rem] text-body2" role="status">
        {on && <span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-good align-middle" aria-hidden="true" />}
        {statusLine}
        {on && syncing && <span className="text-muted"> · syncing…</span>}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Session mode"
        disabled={busy === "starting" || busy === "ending" || busy === "backfill"}
        onClick={() => (session ? end(session.id, "manual", false) : turnOn())}
        className={`mt-8 min-h-[76px] rounded-full px-14 text-[1.375rem] font-extrabold transition-colors disabled:cursor-progress disabled:opacity-60 ${
          on
            ? "breathe border border-gold bg-transparent text-gold shadow-[0_0_0_10px_rgba(227,195,90,0.08)] hover:bg-[rgba(227,195,90,0.08)]"
            : "bg-gold text-[color:var(--on-gold)] shadow-[0_0_0_10px_rgba(227,195,90,0.12),0_20px_50px_rgba(0,0,0,0.4)] hover:bg-[color:var(--walnut-hover)]"
        }`}
      >
        {busy === "starting" ? "Starting…" : busy === "ending" ? "Stopping…" : on ? "Turn session off" : "Start a session"}
      </button>

      <p className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.9375rem]">
        <button type="button" className="font-bold text-gold underline underline-offset-4 disabled:opacity-50" onClick={analyzeLast} disabled={busy !== null}>
          {busy === "analyzing" ? "Syncing…" : "Analyze my last game"}
        </button>
        <button
          type="button"
          className="text-muted underline-offset-4 enabled:text-body2 enabled:hover:underline disabled:cursor-not-allowed"
          disabled={!endTarget || busy !== null}
          onClick={() => endTarget && end(endTarget.id, endTarget === leftOpen ? "tab_closed" : "manual", true)}
        >
          End session &amp; summarize
        </button>
      </p>

      {engine === "waking" && <p className="mt-3 text-sm text-muted">Loading the engines…</p>}
      {engine === "error" && <p className="mt-3 text-sm text-muted">Maia didn&apos;t load. It will retry when a game needs it.</p>}
      {leftOpen && !on && (
        <p className="mt-3 max-w-[560px] text-sm text-body2">
          A session from {new Date(leftOpen.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} was left open.
          End it to see its summary, or start a new one.
        </p>
      )}
      {message && <p className="mt-3 text-sm text-body2">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-[color:var(--blunder-bg)]" role="alert">
          {error}
        </p>
      )}

      {on && (
        <div className="mt-8 w-full max-w-[680px] text-left">
          <p className="label-data mb-1 text-center text-gold">This session</p>
          {games.length === 0 ? (
            <p className="text-center text-sm text-muted">Waiting for your first finished game…</p>
          ) : (
            <ul>
              {games.map((g) => {
                const flags: { severity: Severity; count: number }[] = [];
                if (g.blunders) flags.push({ severity: "blunder", count: g.blunders });
                if (g.mistakes) flags.push({ severity: "mistake", count: g.mistakes });
                return (
                  <li key={g.id} className="row-lift flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-2 py-2.5 text-sm">
                    <span className="font-semibold text-ink">vs {g.opponent}</span>
                    <span className={g.result === "win" ? "font-bold text-good" : g.result === "loss" ? "font-bold text-[color:var(--loss)]" : "text-body2"}>{RESULT[g.result]}</span>
                    <span className="text-muted">{tcLabel(g.time_control)}</span>
                    {flags.map((f) => (
                      <SeverityChip key={f.severity} severity={f.severity} count={f.count} />
                    ))}
                    <span className="ml-auto text-muted">{statusLabel(g, analysis.jobs[g.id])}</span>
                    <Link href={`/games/${g.id}`} className="font-bold text-gold">
                      Review
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
