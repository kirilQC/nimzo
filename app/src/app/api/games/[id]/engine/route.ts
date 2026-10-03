import { NextResponse } from "next/server";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { buildAnalysis, enginePayloadSchema } from "@/lib/analysis/persist";
import { logError } from "@/lib/log";

export const maxDuration = 30;

/**
 * Step 1 of the analysis pipeline: store the browser's Stockfish results.
 * Idempotent: re-posting replaces the positions and sets the game to engine_done.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/engine">) {
  const { id } = await ctx.params;
  const parsed = enginePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad payload" }, { status: 400 });

  const db = await getDb();
  const { data: game } = await db.from(T.games).select("id, pgn, my_color").eq("id", id).maybeSingle();
  if (!game) return NextResponse.json({ error: "game not found" }, { status: 404 });

  try {
    const { data: settings } = await db.from(T.settings).select("thresholds").single();
    const t = (settings?.thresholds ?? {}) as { inaccuracy?: number; mistake?: number; blunder?: number };
    const thresholds = t.inaccuracy && t.mistake && t.blunder ? { inaccuracy: t.inaccuracy, mistake: t.mistake, blunder: t.blunder } : undefined;

    const { rows, totals } = buildAnalysis({ gameId: id, pgn: game.pgn, myColor: game.my_color, payload: parsed.data, thresholds });

    const { error: delErr } = await db.from(T.positions).delete().eq("game_id", id);
    if (delErr) throw new Error(`clear positions: ${delErr.message}`);
    const { error: insErr } = await db.from(T.positions).insert(rows);
    if (insErr) throw new Error(`insert positions: ${insErr.message}`);

    const { error: upErr } = await db
      .from(T.games)
      .update({ ...totals, analysis_status: "engine_done", analysis_error: null, analysis_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) throw new Error(`update game: ${upErr.message}`);

    return NextResponse.json({ ok: true, ...totals });
  } catch (e) {
    await logError("analysis.engine", e, { engine: parsed.data.engine, depth: parsed.data.depth }, id);
    await db.from(T.games).update({ analysis_status: "failed", analysis_error: (e as Error).message }).eq("id", id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
