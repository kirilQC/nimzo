import { NextResponse } from "next/server";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";

/** What the browser needs to run the engine pass on a game. */
export async function GET(_request: Request, ctx: RouteContext<"/api/games/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const { data } = await db.from(T.games).select("id, pgn, my_color, analysis_status").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
