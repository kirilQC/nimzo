import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { RPC, T } from "@/lib/supabase/tables";

export type GameRow = {
  id: string;
  opponent: string;
  opponent_rating: number | null;
  my_color: "white" | "black";
  result: "win" | "loss" | "draw";
  time_class: string | null;
  end_time: string;
  eco: string | null;
  opening_name: string | null;
  accuracy_ours: number | null;
  blunders: number | null;
  misses: number | null;
  mistakes: number | null;
  inaccuracies: number | null;
  analysis_status: string;
  my_rating: number | null;
  result_detail: string | null;
  move_count: number | null;
  time_control: string | null;
  accuracy_chesscom: number | null;
};

const GAME_COLUMNS =
  "id, opponent, opponent_rating, my_color, result, time_class, end_time, eco, opening_name, accuracy_ours, blunders, misses, mistakes, inaccuracies, analysis_status, my_rating, result_detail, move_count, time_control, accuracy_chesscom";

/** Every imported chess.com game, newest first (paged past the API's 1,000-row cap). */
export async function getAllGames(): Promise<GameRow[]> {
  const db = await getDb();
  const out: GameRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(T.games)
      .select(GAME_COLUMNS)
      .eq("source", "chesscom")
      .order("end_time", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`getAllGames: ${error.message}`);
    out.push(...((data ?? []) as GameRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getRecentGames(limit = 10, timeClasses: string[] = ["rapid", "blitz"]): Promise<GameRow[]> {
  const db = await getDb();
  const { data, error } = await db
    .from(T.games)
    .select(GAME_COLUMNS)
    .eq("source", "chesscom")
    .in("time_class", timeClasses)
    .order("end_time", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentGames: ${error.message}`);
  return (data ?? []) as GameRow[];
}

export type PatternStat = { motif: string; games: number; occurrences: number };

export async function getPatternStats(windowGames = 30): Promise<PatternStat[]> {
  const db = await getDb();
  const { data, error } = await db.rpc(RPC.pattern_stats, { window_games: windowGames });
  if (error) throw new Error(`getPatternStats: ${error.message}`);
  return (data ?? []) as PatternStat[];
}

export async function getSettings() {
  const db = await getDb();
  const { data, error } = await db.from(T.settings).select("*").single();
  if (error) throw new Error(`getSettings: ${error.message}`);
  return data;
}

export type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  summary: { headline?: string } | null;
};

export async function getSessions(limit = 50): Promise<SessionRow[]> {
  const db = await getDb();
  const { data, error } = await db
    .from(T.sessions)
    .select("id, started_at, ended_at, summary")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getSessions: ${error.message}`);
  return (data ?? []) as SessionRow[];
}

/** True until the first chess.com sync has recorded any archive. */
export async function needsBackfill(): Promise<boolean> {
  const db = await getDb();
  const { count, error } = await db.from(T.chesscom_archives).select("url", { count: "exact", head: true });
  if (error) throw new Error(`needsBackfill: ${error.message}`);
  return (count ?? 0) === 0;
}
