import { NextResponse } from "next/server";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { logError } from "@/lib/log";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fail"), error: z.string().max(2000) }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("reanalyze") }),
]);

/**
 * Marks a game's analysis as failed (from the browser), resets it so it can be
 * retried, or wipes its analysis so it runs again from scratch (Q&A history is kept).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/status">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = await getDb();
  if (parsed.data.action === "fail") {
    await logError("analysis.browser", new Error(parsed.data.error), {}, id);
    await db.from(T.games).update({ analysis_status: "failed", analysis_error: parsed.data.error }).eq("id", id);
  } else if (parsed.data.action === "reanalyze") {
    for (const table of [T.mistakes, T.game_reviews, T.positions]) {
      const r = await db.from(table).delete().eq("game_id", id);
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
    await db
      .from(T.games)
      .update({ analysis_status: "imported", analysis_error: null, accuracy_ours: null, blunders: null, misses: null, mistakes: null, inaccuracies: null })
      .eq("id", id);
  } else {
    await db.from(T.games).update({ analysis_status: "imported", analysis_error: null }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
