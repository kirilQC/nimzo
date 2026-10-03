"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SeverityChip, type Severity } from "@/components/ui";

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

function statusLabel(g: SessionGame): string {
  switch (g.analysis_status) {
    case "imported":
      return "Imported";
    case "failed":
      return "Analysis failed";
    case "reviewed":
      return `Analyzed · ${timeAgo(g.end_time)}`;
    default:
      return "Analyzing";
  }
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
    [router],
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
      // Wake the Maia engine on Render so it's warm by the time the first game ends.
      postJson<{ status: string }>("/api/engine/wake")
        .then((r) => setEngine(r.status === "not_configured" ? null : r.status === "awake" ? "awake" : "error"))
        .catch(() => setEngine("error"));
      setEngine((prev) => prev ?? "waking");
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
  const statusLine = on
    ? "On · checking chess.com every 60 seconds for finished games"
    : busy === "backfill"
      ? `Importing your last ${backfillMonths} months from chess.com…`
      : "Off · nothing is running.";

  return (
    <section className="card p-6" aria-labelledby={labelId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={labelId} className="text-[1.75rem] leading-tight">
            Session mode
          </h2>
          <p className="mt-1 text-[0.9375rem] text-body2" role="status">
            {statusLine}
            {on && syncing && <span className="text-muted"> · syncing…</span>}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          className="toggle"
          disabled={busy === "starting" || busy === "ending"}
          onClick={() => (session ? end(session.id, "manual", false) : turnOn())}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={analyzeLast} disabled={busy !== null}>
          {busy === "analyzing" ? "Syncing…" : "Analyze my last game"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!endTarget || busy !== null}
          onClick={() => endTarget && end(endTarget.id, endTarget === leftOpen ? "tab_closed" : "manual", true)}
        >
          End session &amp; summarize
        </button>
      </div>

      {engine === "waking" && <p className="mt-3 text-sm text-muted">Waking the engine…</p>}
      {engine === "error" && <p className="mt-3 text-sm text-muted">The engine didn&apos;t answer. It will retry when a game needs it.</p>}
      {leftOpen && !on && (
        <p className="mt-3 text-sm text-body2">
          A session from {new Date(leftOpen.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} was left open.
          End it to see its summary, or turn Session mode on to start a new one.
        </p>
      )}
      {message && <p className="mt-3 text-sm text-body2">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-[color:var(--blunder-bg)]" role="alert">
          {error}
        </p>
      )}

      {on && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <p className="eyebrow mb-2">This session</p>
          {games.length === 0 ? (
            <p className="text-sm text-muted">Waiting for your first finished game…</p>
          ) : (
            <ul className="space-y-2">
              {games.map((g) => {
                const flags: { severity: Severity; count: number }[] = [];
                if (g.blunders) flags.push({ severity: "blunder", count: g.blunders });
                if (g.mistakes) flags.push({ severity: "mistake", count: g.mistakes });
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-ink">
                      vs {g.opponent} · {RESULT[g.result]} · {tcLabel(g.time_control)}
                    </span>
                    {flags.map((f) => (
                      <SeverityChip key={f.severity} severity={f.severity} count={f.count} />
                    ))}
                    <span className="text-muted">{statusLabel(g)}</span>
                    <Link href={`/games/${g.id}`} className="arrow-link">
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
