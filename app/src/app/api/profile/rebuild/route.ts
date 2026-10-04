import { NextResponse } from "next/server";
import { rebuildProfile } from "@/lib/profile/synthesize";
import { logError } from "@/lib/log";

export const maxDuration = 300; // statistics over every analyzed move, then one long Claude call

/** Rebuilds the player model: fresh statistics, then Arthur's written profile and memory. */
export async function POST() {
  try {
    return NextResponse.json(await rebuildProfile("rapid"));
  } catch (e) {
    await logError("profile.rebuild", e, {});
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
