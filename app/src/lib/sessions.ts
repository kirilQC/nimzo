import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";

export type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  ended_reason: string | null;
};

export type SessionGameRow = {
  id: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  time_control: string | null;
  time_class: string | null;
  end_time: string;
  analysis_status: string;
  analysis_updated_at: string | null;
  blunders: number | null;
  mistakes: number | null;
  inaccuracies: number | null;
};

const SESSION_COLS = "id, started_at, ended_at, last_activity_at, ended_reason";

/** The most recent session that was never ended (e.g. the tab was closed), if any. */
export async function getOpenSession(): Promise<SessionRow | null> {
  const db = await getDb();
  const { data } = await db
    .from(T.sessions)
    .select(SESSION_COLS)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

export async function getSessionGames(sessionId: string): Promise<SessionGameRow[]> {
  const db = await getDb();
  const { data, error } = await db
    .from(T.games)
    .select("id, opponent, result, time_control, time_class, end_time, analysis_status, analysis_updated_at, blunders, mistakes, inaccuracies")
    .eq("session_id", sessionId)
    .order("end_time", { ascending: false });
  if (error) throw new Error(`getSessionGames: ${error.message}`);
  return (data ?? []) as SessionGameRow[];
}

async function currentRapidRating(): Promise<number | null> {
  const db = await getDb();
  const { data } = await db.from(T.settings).select("ratings").single();
  const r = (data?.ratings ?? {}) as Record<string, number>;
  return r.rapid ?? r.blitz ?? null;
}

/** Starts a session. Any older open session is closed as 'tab_closed' (its summary can still be generated later). */
export async function startSession(): Promise<SessionRow> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.from(T.sessions).update({ ended_at: now, ended_reason: "tab_closed" }).is("ended_at", null);
  const { data, error } = await db
    .from(T.sessions)
    .insert({ started_at: now, last_activity_at: now, rating_start: await currentRapidRating() })
    .select(SESSION_COLS)
    .single();
  if (error) throw new Error(`startSession: ${error.message}`);
  return data as SessionRow;
}

export async function endSession(id: string, reason: "manual" | "auto_off" | "tab_closed"): Promise<SessionRow | null> {
  const db = await getDb();
  const { data, error } = await db
    .from(T.sessions)
    .update({ ended_at: new Date().toISOString(), ended_reason: reason, rating_end: await currentRapidRating() })
    .eq("id", id)
    .is("ended_at", null)
    .select(SESSION_COLS)
    .maybeSingle();
  if (error) throw new Error(`endSession: ${error.message}`);
  return (data as SessionRow | null) ?? null;
}
