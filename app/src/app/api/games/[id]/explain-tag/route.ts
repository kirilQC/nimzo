import { NextResponse } from "next/server";
import { z } from "zod";
import { explainTag } from "@/lib/coach/explainTag";
import { logError } from "@/lib/log";

export const maxDuration = 60;

const body = z.object({ ply: z.number().int().min(1).max(1000), tag: z.string().regex(/^[a-z_]{2,48}$/) });

/** Arthur explains why one tag was put on one move (cached after the first time). */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/explain-tag">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await explainTag(id, parsed.data.ply, parsed.data.tag));
  } catch (e) {
    await logError("coach.explain_tag", e, parsed.data, id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
