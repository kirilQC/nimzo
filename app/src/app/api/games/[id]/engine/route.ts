import { NextResponse } from "next/server";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { enginePayloadSchema } from "@/lib/analysis/persist";
import { logError } from "@/lib/log";
import { saveEngineResults } from "@/lib/pipeline";

export const maxDuration = 30;

/**
 * Step 1 of the analysis pipeline: store the browser's Stockfish results.
 * Idempotent: re-posting replaces the positions; the facts step follows.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/engine">) {
  const { id } = await ctx.params;
  const parsed = enginePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad payload" }, { status: 400 });
  try {
    const { mistakes } = await saveEngineResults(id, parsed.data);
    return NextResponse.json({ ok: true, mistakes });
  } catch (e) {
    await logError("analysis.engine", e, { engine: parsed.data.engine, depth: parsed.data.depth }, id);
    const db = await getDb();
    await db.from(T.games).update({ analysis_status: "failed", analysis_error: (e as Error).message }).eq("id", id);
    const status = (e as Error).message === "game not found" ? 404 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
