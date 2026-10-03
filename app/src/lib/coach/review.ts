import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";
import type { MoveFeatures } from "@/lib/analysis/features";
import { describeEnding } from "@/lib/chess/ending";
import { structuredCall } from "./claude";
import { COACH_VOICE, GAME_REVIEW_TASK } from "./prompts";
import { notationIn } from "./guard";
import { plainMove } from "./plain";

const reviewSchema = z.object({
  headline: z.string(),
  verdict: z.enum(["excellent", "good", "mixed", "rough"]),
  overview: z.string(),
  went_well: z.string(),
  work_on: z.string(),
  moves: z.array(z.object({ ply: z.number().int(), note: z.string() })),
});
export type GameReviewOutput = z.infer<typeof reviewSchema>;
export type GameSummaryV2 = Omit<GameReviewOutput, "moves"> & { version: 2 };

type FeatureRow = { ply: number; features: MoveFeatures; tags: string[]; intent: string | null; root_cause: string | null };

/** How this game's accuracy compares with the player's other analyzed games. */
async function history(db: Awaited<ReturnType<typeof getDb>>, gameId: string, accuracy: number | null) {
  const { data } = await db.from(T.games).select("id, accuracy_ours").not("accuracy_ours", "is", null).neq("id", gameId).limit(2000);
  const accs = (data ?? []).map((g) => Number(g.accuracy_ours)).sort((a, b) => a - b);
  if (!accs.length || accuracy === null) return { analyzed_games: accs.length };
  const below = accs.filter((a) => a < accuracy).length;
  return {
    analyzed_games: accs.length,
    your_typical_accuracy: Math.round(accs[Math.floor(accs.length / 2)]! * 10) / 10,
    this_game_accuracy: accuracy,
    this_game_better_than_pct_of_your_games: Math.round((below / accs.length) * 100),
  };
}

/**
 * Step 5: Arthur's review. One call writes the whole-game verdict and a plain
 * one-sentence note for every move (both sides). Notes go to move_features (and
 * the mistakes rows for flagged moves); the summary to game_reviews.
 */
export async function runReviewStep(gameId: string): Promise<{ notes: number; model: string }> {
  const db = await getDb();
  const [{ data: game }, { data: rows, error }, { data: mistakes }] = await Promise.all([
    db.from(T.games).select("my_color, opponent, opponent_rating, my_rating, result, result_detail, time_control, time_class, opening_name, accuracy_ours, move_count").eq("id", gameId).single(),
    db.from(T.move_features).select("ply, features, tags, intent, root_cause").eq("game_id", gameId).order("ply"),
    db.from(T.mistakes).select("id, ply, maia").eq("game_id", gameId),
  ]);
  if (!game) throw new Error("game not found");
  if (error) throw new Error(`load move features: ${error.message}`);
  const feats = (rows ?? []) as FeatureRow[];
  if (!feats.length) throw new Error("no move features; run the facts step first");
  const maia = new Map((mistakes ?? []).map((m) => [m.ply as number, m.maia as { p_played: number; p_best: number | null } | null]));

  const mine = feats.filter((r) => r.features.mine);
  const count = (who: FeatureRow[]) => who.reduce<Record<string, number>>((acc, r) => ((acc[r.features.label ?? "unrated"] = (acc[r.features.label ?? "unrated"] ?? 0) + 1), acc), {});
  const input = {
    game: {
      kiril_played: game.my_color,
      opponent: game.opponent,
      ratings: { kiril: game.my_rating, opponent: game.opponent_rating },
      result_for_kiril: game.result,
      how_it_ended: describeEnding(game.result, game.result_detail).long,
      time_control: game.time_control,
      opening: game.opening_name,
      moves_played: game.move_count,
      kiril_accuracy: game.accuracy_ours,
      kiril_move_ratings: count(mine),
      opponent_move_ratings: count(feats.filter((r) => !r.features.mine)),
    },
    compared_with_kirils_other_games: await history(db, gameId, game.accuracy_ours === null ? null : Number(game.accuracy_ours)),
    moves: feats.map((r) => plainMove(r.features, r.tags ?? [], { intent: r.intent, root_cause: r.root_cause, maia: maia.get(r.ply) ?? null })),
  };

  const system = `${COACH_VOICE}\n\n${GAME_REVIEW_TASK}`;
  let user = JSON.stringify(input);
  let out: GameReviewOutput | null = null;
  let model = env().CLAUDE_MODEL_REVIEW;
  const plies = new Set(feats.map((r) => r.ply));

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_REVIEW, system, user, schema: reviewSchema, effort: "medium", maxTokens: 16000 });
    out = res.data;
    model = res.model;
    const problems: string[] = [];
    const missing = [...plies].filter((p) => !out!.moves.some((m) => m.ply === p));
    if (missing.length) problems.push(`missing notes for plies ${missing.join(", ")}`);
    for (const m of out.moves) {
      const n = notationIn(m.note);
      if (n.length) problems.push(`ply ${m.ply} uses notation (${n.join(", ")})`);
    }
    const sumNotation = notationIn([out.headline, out.overview, out.went_well, out.work_on].join(" "));
    if (sumNotation.length) problems.push(`summary uses notation (${sumNotation.join(", ")})`);
    if (!problems.length) break;
    await logError("coach.review", new Error("review broke a rule"), { problems: problems.slice(0, 20), attempt }, gameId);
    if (attempt === 0) user = `${JSON.stringify(input)}\n\nYour previous answer broke these rules: ${problems.slice(0, 20).join("; ")}. Write it again: one plain sentence for every move, no notation or square names anywhere.`;
  }
  if (!out) throw new Error("no review produced");

  const noteByPly = new Map(out.moves.filter((m) => plies.has(m.ply)).map((m) => [m.ply, m.note.trim()]));
  for (const [ply, note] of noteByPly) {
    const { error: e } = await db.from(T.move_features).update({ note }).eq("game_id", gameId).eq("ply", ply);
    if (e) throw new Error(`save note: ${e.message}`);
  }
  for (const m of mistakes ?? []) {
    const note = noteByPly.get(m.ply as number);
    if (note) await db.from(T.mistakes).update({ explanation: note, explanation_model: model }).eq("id", m.id);
  }
  const summary: GameSummaryV2 = { version: 2, headline: out.headline, verdict: out.verdict, overview: out.overview, went_well: out.went_well, work_on: out.work_on };
  const { error: revErr } = await db.from(T.game_reviews).upsert({ game_id: gameId, summary, model }, { onConflict: "game_id" });
  if (revErr) throw new Error(`save summary: ${revErr.message}`);
  await db.from(T.games).update({ analysis_status: "reviewed", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  return { notes: noteByPly.size, model };
}
