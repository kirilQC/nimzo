import { NextResponse } from "next/server";
import { z } from "zod";
import { askAboutGame } from "@/lib/coach/ask";
import { logError } from "@/lib/log";

export const maxDuration = 60;

const body = z.object({ question: z.string().min(1).max(1000), ply: z.number().int().min(0).max(1000) });

/** Ask Arthur about a finished game. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/ask">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await askAboutGame(id, parsed.data.question, parsed.data.ply));
  } catch (e) {
    await logError("coach.ask", e, { ply: parsed.data.ply }, id);
    return NextResponse.json({ error: "Arthur couldn't answer that just now." }, { status: 500 });
  }
}
