import { NextResponse } from "next/server";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { logError } from "@/lib/log";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fail"), error: z.string().max(2000) }),
  z.object({ action: z.literal("retry") }),
]);

/** Marks a game's analysis as failed (from the browser), or resets it so it can be retried. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/status">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = await getDb();
  if (parsed.data.action === "fail") {
    await logError("analysis.browser", new Error(parsed.data.error), {}, id);
    await db.from(T.games).update({ analysis_status: "failed", analysis_error: parsed.data.error }).eq("id", id);
  } else {
    await db.from(T.games).update({ analysis_status: "imported", analysis_error: null }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
