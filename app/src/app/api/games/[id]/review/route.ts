import { NextResponse } from "next/server";
import { runReviewStep } from "@/lib/coach/review";
import { failGame } from "@/lib/pipeline";

export const maxDuration = 120;

/** Step 5: Claude explains each flagged move and summarizes the game. */
export async function POST(_req: Request, ctx: RouteContext<"/api/games/[id]/review">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await runReviewStep(id));
  } catch (e) {
    await failGame(id, "coach.review", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
