import { NextResponse } from "next/server";
import { refreshCoachNote } from "@/lib/coach/note";
import { logError } from "@/lib/log";

export const maxDuration = 60;

/** Regenerates the Home coach's note after an analysis batch. */
export async function POST() {
  try {
    return NextResponse.json({ note: await refreshCoachNote() });
  } catch (e) {
    await logError("coach.note", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
