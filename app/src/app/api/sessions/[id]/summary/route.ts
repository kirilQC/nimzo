import { NextResponse } from "next/server";
import { summarizeSession } from "@/lib/coach/session";
import { logError } from "@/lib/log";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: RouteContext<"/api/sessions/[id]/summary">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ summary: await summarizeSession(id) });
  } catch (e) {
    await logError("coach.session", e, { sessionId: id });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
