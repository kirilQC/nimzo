import { NextResponse } from "next/server";
import { z } from "zod";
import { endSession, getOpenSession, getSessionGames, startSession } from "@/lib/sessions";
import { logError } from "@/lib/log";

export async function GET() {
  const session = await getOpenSession();
  return NextResponse.json({ session, games: session ? await getSessionGames(session.id) : [] });
}

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("end"), id: z.string().uuid(), reason: z.enum(["manual", "auto_off", "tab_closed"]) }),
]);

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    if (parsed.data.action === "start") return NextResponse.json({ session: await startSession() });
    return NextResponse.json({ session: await endSession(parsed.data.id, parsed.data.reason) });
  } catch (e) {
    await logError("session", e, parsed.data);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
