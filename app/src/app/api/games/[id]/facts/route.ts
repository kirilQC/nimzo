import { NextResponse } from "next/server";
import { failGame, runFactsStep } from "@/lib/pipeline";

/** Step 2 on its own, for resuming a game that stopped at engine_done. */
export async function POST(_req: Request, ctx: RouteContext<"/api/games/[id]/facts">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await runFactsStep(id));
  } catch (e) {
    await failGame(id, "analysis.facts", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
