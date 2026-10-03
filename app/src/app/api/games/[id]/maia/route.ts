import { NextResponse } from "next/server";
import { maiaPayloadSchema, mistakesForMaia, saveMaia } from "@/lib/pipeline";
import { logError } from "@/lib/log";

/** GET: the positions the browser should run Maia on. POST: store Maia's probabilities. */
export async function GET(_req: Request, ctx: RouteContext<"/api/games/[id]/maia">) {
  const { id } = await ctx.params;
  return NextResponse.json(await mistakesForMaia(id));
}

export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/maia">) {
  const { id } = await ctx.params;
  const parsed = maiaPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad payload" }, { status: 400 });
  try {
    await saveMaia(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError("analysis.maia", e, {}, id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
