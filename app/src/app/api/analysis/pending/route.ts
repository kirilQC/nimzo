import { NextResponse } from "next/server";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";

// Statuses the browser pipeline still has work to do on. "tagged" games are fully analyzed;
// Arthur writes their review when the game is opened, so they aren't queued here.
const PENDING = ["imported", "engine_done", "facts_done"];

/**
 * Games waiting for the browser pipeline, newest first.
 * ?recent=20 limits the check to the N most recent games (auto-analysis);
 * without it, returns the whole backlog.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const recent = Number(url.searchParams.get("recent")) || null;
  const db = await getDb();

  let ids: string[];
  if (recent) {
    const { data } = await db
      .from(T.games)
      .select("id, analysis_status")
      .eq("source", "chesscom")
      .order("end_time", { ascending: false })
      .limit(recent);
    ids = (data ?? []).filter((g) => PENDING.includes(g.analysis_status)).map((g) => g.id);
  } else {
    const { data } = await db
      .from(T.games)
      .select("id")
      .in("analysis_status", PENDING)
      .order("end_time", { ascending: false })
      .limit(1000);
    ids = (data ?? []).map((g) => g.id);
  }
  const { count } = await db.from(T.games).select("id", { count: "exact", head: true }).in("analysis_status", PENDING);
  return NextResponse.json({ ids, backlog: count ?? 0 });
}
