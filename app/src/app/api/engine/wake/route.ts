import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Session mode pings the Render engine (Maia) so it's warm by the time the
// first game finishes. Render free instances can take ~60s to wake.
export const maxDuration = 70;

export async function POST() {
  const url = env().ENGINE_URL;
  if (!url) return NextResponse.json({ status: "not_configured" });
  const started = Date.now();
  try {
    const res = await fetch(new URL("/health", url), { cache: "no-store", signal: AbortSignal.timeout(65_000) });
    return NextResponse.json({ status: res.ok ? "awake" : "error", ms: Date.now() - started });
  } catch {
    return NextResponse.json({ status: "error", ms: Date.now() - started });
  }
}
