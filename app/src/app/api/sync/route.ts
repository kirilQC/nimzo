import { NextResponse } from "next/server";
import { z } from "zod";
import { syncChesscom } from "@/lib/chesscom/sync";
import { getSessionGames } from "@/lib/sessions";
import { logError } from "@/lib/log";

// FAIR PLAY: this route only imports FINISHED games from chess.com's public
// monthly archives. It must never be used to read or react to a live game.

export const maxDuration = 60;

const body = z
  .object({
    sessionId: z.string().uuid().nullish(),
    history: z.object({ months: z.union([z.number().int().min(1).max(240), z.literal("all")]), chunk: z.number().int().min(1).max(12).optional() }).optional(),
  })
  .default({});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { sessionId, history } = parsed.data;

  try {
    const result = await syncChesscom({ sessionId, history });
    const sessionGames = sessionId ? await getSessionGames(sessionId) : undefined;
    return NextResponse.json({ ...result, sessionGames });
  } catch (e) {
    await logError("sync", e, { sessionId });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
