import { NextResponse } from "next/server";
import { failGame, runTagStep } from "@/lib/pipeline";

export const maxDuration = 60;

/** Step 4: classify the game's mistakes with Jev (Claude fallback). */
export async function POST(_req: Request, ctx: RouteContext<"/api/games/[id]/tag">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await runTagStep(id));
  } catch (e) {
    await failGame(id, "analysis.tag", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
