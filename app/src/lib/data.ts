import "server-only";
import { requireOwner } from "@/lib/auth";

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
  mistakes: number | null;
  inaccuracies: number | null;
  analysis_status: string;
};

const GAME_COLUMNS =
  "id, opponent, opponent_rating, my_color, result, time_class, end_time, eco, opening_name, accuracy_ours, blunders, mistakes, inaccuracies, analysis_status";

export async function getRecentGames(limit = 10, timeClasses: string[] = ["rapid", "blitz"]): Promise<GameRow[]> {
  const db = await requireOwner();
  const { data, error } = await db
    .from("games")
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
  const db = await requireOwner();
  const { data, error } = await db.rpc("pattern_stats", { window_games: windowGames });
  if (error) throw new Error(`getPatternStats: ${error.message}`);
  return (data ?? []) as PatternStat[];
}

export async function getSettings() {
  const db = await requireOwner();
  const { data, error } = await db.from("settings").select("*").single();
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
  const db = await requireOwner();
  const { data, error } = await db
    .from("sessions")
    .select("id, started_at, ended_at, summary")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getSessions: ${error.message}`);
  return (data ?? []) as SessionRow[];
}
