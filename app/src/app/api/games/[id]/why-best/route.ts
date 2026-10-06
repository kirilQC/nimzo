import { NextResponse } from "next/server";
import { z } from "zod";
import { whyBest } from "@/lib/coach/whyBest";
import { logError } from "@/lib/log";

export const maxDuration = 60;

const body = z.object({ ply: z.number().int().min(1).max(1000) });

/** Why the engine's best move from the position before `ply` is best, in a sentence or two (cached after the first time). */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/why-best">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await whyBest(id, parsed.data.ply));
  } catch (e) {
    await logError("coach.why_best", e, parsed.data, id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
