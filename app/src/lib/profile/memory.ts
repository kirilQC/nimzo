import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";

let cached: { text: string | null; at: number } | null = null;
const TTL_MS = 10 * 60_000;

/**
 * What Arthur knows about the player from every analyzed game (the latest
 * profile's memory), ready to drop into a system prompt. Cached for ten
 * minutes; empty until the first profile is built.
 */
export async function playerMemory(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.text ? block(cached.text) : "";
  try {
    const db = await getDb();
    const { data } = await db.from(T.player_profiles).select("memory").not("memory", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    cached = { text: (data?.memory as string | null) ?? null, at: Date.now() };
  } catch {
    cached = { text: null, at: Date.now() }; // profile table not there yet: carry on without it
  }
  return cached.text ? block(cached.text) : "";
}

function block(text: string) {
  return `What you know about how he plays, from every game Nimzo analyzed (use it to connect this game to his habits, for example "this is the same thing that happened in many of your games"; never invent numbers beyond these):\n${text}`;
}
