import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { parseClock } from "@/lib/chess/pgn";
import type { MoveFacts } from "@/lib/analysis/facts";
import { MOTIFS, motifLabel } from "@/lib/taxonomy";
import { structuredCall } from "./claude";
import { COACH_VOICE, SESSION_SUMMARY_TASK } from "./prompts";

export const CLOCK_BUCKETS = [
  { bucket: "5 min +", min: 300_000, max: Infinity },
  { bucket: "2–5 min", min: 120_000, max: 300_000 },
  { bucket: "1–2 min", min: 60_000, max: 120_000 },
  { bucket: "Under 1 min", min: 0, max: 60_000 },
] as const;

/** Blunders grouped by the time the player had left when making the move. */
export function clockBuckets(clocksMs: (number | null)[]) {
  return CLOCK_BUCKETS.map((b) => ({ bucket: b.bucket, blunders: clocksMs.filter((c) => c !== null && c >= b.min && c < b.max).length }));
}

export type SessionSummary = {
  headline: string;
  takeaway: string;
  next_step: { motif: string; label: string; href: string } | null;
  stats: { wins: number; losses: number; draws: number; blunders: number; avg_accuracy: number | null; rating_change: number | null; games: number; analyzed: number };
  clock_buckets: { bucket: string; blunders: number }[];
};

const outSchema = z.object({
  headline: z.string(),
  takeaway: z.string(),
  next_step_motif: z.enum(MOTIFS.map((m) => m.id) as [string, ...string[]]),
  next_step_label: z.string(),
});

export async function summarizeSession(sessionId: string): Promise<SessionSummary | null> {
  const db = await getDb();
  const { data: session } = await db.from(T.sessions).select("id, rating_start").eq("id", sessionId).single();
  if (!session) throw new Error("session not found");
  const { data: games } = await db
    .from(T.games)
    .select("id, opponent, result, opening_name, accuracy_ours, blunders, mistakes, inaccuracies, my_rating, end_time, analysis_status, time_class")
    .eq("session_id", sessionId)
    .order("end_time");
  const list = games ?? [];
  if (!list.length) {
    await db.from(T.sessions).update({ summary: null, summarized_at: new Date().toISOString() }).eq("id", sessionId);
    return null;
  }

  const ids = list.map((g) => g.id);
  const [{ data: blunders }, { data: reviews }] = await Promise.all([
    db.from(T.mistakes).select("game_id, facts, motifs").in("game_id", ids).eq("classification", "blunder"),
    db.from(T.game_reviews).select("game_id, summary").in("game_id", ids),
  ]);
  const blunderClocks = (blunders ?? []).map((b) => {
    const left = (b.facts as MoveFacts).clock.left_before_move ?? (b.facts as MoveFacts).clock.left_after_move;
    return left ? parseClock(left) : null;
  });

  const accs = list.map((g) => g.accuracy_ours).filter((a): a is number => a !== null).map(Number);
  const last = list.at(-1)!;
  const stats = {
    wins: list.filter((g) => g.result === "win").length,
    losses: list.filter((g) => g.result === "loss").length,
    draws: list.filter((g) => g.result === "draw").length,
    blunders: list.reduce((s, g) => s + (g.blunders ?? 0), 0),
    avg_accuracy: accs.length ? Math.round((accs.reduce((a, b) => a + b, 0) / accs.length) * 10) / 10 : null,
    rating_change: session.rating_start && last.my_rating ? last.my_rating - session.rating_start : null,
    games: list.length,
    analyzed: list.filter((g) => ["tagged", "reviewed"].includes(g.analysis_status)).length,
  };
  const buckets = clockBuckets(blunderClocks);

  const motifCounts = new Map<string, number>();
  for (const b of blunders ?? []) for (const m of (b.motifs as string[]) ?? []) motifCounts.set(m, (motifCounts.get(m) ?? 0) + 1);
  const reviewByGame = new Map((reviews ?? []).map((r) => [r.game_id, r.summary]));

  const { data } = await structuredCall({
    model: env().CLAUDE_MODEL_COACH,
    system: `${COACH_VOICE}\n\n${SESSION_SUMMARY_TASK}`,
    user: JSON.stringify({
      stats,
      blunders_by_time_left: buckets,
      blunder_motifs: [...motifCounts].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ motif_id: id, motif: motifLabel(id), times: n })),
      games: list.map((g) => ({
        result: g.result,
        opponent: g.opponent,
        opening: g.opening_name,
        accuracy: g.accuracy_ours,
        flags: { blunders: g.blunders, mistakes: g.mistakes, inaccuracies: g.inaccuracies },
        coach_summary: reviewByGame.get(g.id) ?? null,
      })),
      allowed_motif_ids: MOTIFS.map((m) => m.id),
    }),
    schema: outSchema,
    effort: "medium",
  });

  const summary: SessionSummary = {
    headline: data.headline.trim(),
    takeaway: data.takeaway.trim(),
    next_step: { motif: data.next_step_motif, label: data.next_step_label.trim(), href: `/learn?drill=${data.next_step_motif}` },
    stats,
    clock_buckets: buckets,
  };
  await db
    .from(T.sessions)
    .update({ summary, summary_model: env().CLAUDE_MODEL_COACH, summarized_at: new Date().toISOString(), rating_end: last.my_rating })
    .eq("id", sessionId);
  return summary;
}
