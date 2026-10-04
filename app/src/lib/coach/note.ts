import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { RPC, T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { motifLabel } from "@/lib/taxonomy";
import { structuredCall } from "./claude";
import { noDashes } from "./text";
import { COACH_NOTE_TASK, COACH_VOICE } from "./prompts";
import { playerMemory } from "@/lib/profile/memory";

export const NOTE_WINDOW = 30;

/** Regenerates the Home "Coach's note" from pattern stats. Returns null if there's nothing to say yet. */
export async function refreshCoachNote(): Promise<string | null> {
  const db = await getDb();
  const { data: stats } = await db.rpc(RPC.pattern_stats, { window_games: NOTE_WINDOW });
  const { count: analyzed } = await db
    .from(T.games)
    .select("id", { count: "exact", head: true })
    .in("analysis_status", ["tagged", "reviewed"])
    .eq("source", "chesscom");
  const top = ((stats ?? []) as { motif: string; games: number; occurrences: number }[]).slice(0, 5);
  if (!top.length) return null;

  const { data } = await structuredCall({
    model: env().CLAUDE_MODEL_COACH,
    system: `${COACH_VOICE}\n\n${await playerMemory()}\n\n${COACH_NOTE_TASK}`,
    user: JSON.stringify({
      games_analyzed: Math.min(analyzed ?? 0, NOTE_WINDOW),
      patterns: top.map((s) => ({ motif: motifLabel(s.motif), motif_id: s.motif, games: s.games, times: s.occurrences })),
    }),
    schema: z.object({ note: z.string(), motif_id: z.string() }),
    effort: "low",
    maxTokens: 2000,
  });
  const note = noDashes(data.note.trim());
  await db.from(T.settings).update({ coach_note: note, coach_note_updated_at: new Date().toISOString() }).eq("id", true);
  return note;
}
