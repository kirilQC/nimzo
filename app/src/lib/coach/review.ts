import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";
import type { MoveFeatures } from "@/lib/analysis/features";
import { describeEnding } from "@/lib/chess/ending";
import { knowledgeFor } from "@/lib/knowledge";
import { structuredCall } from "./claude";
import { COACH_VOICE, GAME_REVIEW_TASK } from "./prompts";
import { notationIn } from "./guard";
import { plainMove } from "./plain";
import { momentum } from "./momentum";
import { bannedIn, longSentences, noDashes } from "./text";

const reviewSchema = z.object({
  headline: z.string(),
  verdict: z.enum(["excellent", "good", "mixed", "rough"]),
  story: z.array(z.string()),
  momentum: z.string(),
  fell_short: z.array(z.string()),
  went_well: z.array(z.string()),
  conclusion: z.string(),
  moves: z.array(z.object({ ply: z.number().int(), note: z.string() })),
  knowledge_used: z.array(z.string()),
});
export type GameReviewOutput = z.infer<typeof reviewSchema>;
export type GameSummaryV3 = Omit<GameReviewOutput, "moves"> & { version: 3 };

type FeatureRow = { ply: number; features: MoveFeatures; tags: string[]; intent: string | null; root_cause: string | null };

/** How this game's accuracy compares with the player's other analyzed games. */
async function history(db: Awaited<ReturnType<typeof getDb>>, gameId: string, accuracy: number | null) {
  const { data } = await db.from(T.games).select("id, accuracy_ours").not("accuracy_ours", "is", null).neq("id", gameId).limit(2000);
  const accs = (data ?? []).map((g) => Number(g.accuracy_ours)).sort((a, b) => a - b);
  if (!accs.length || accuracy === null) return { analyzed_games: accs.length };
  const below = accs.filter((a) => a < accuracy).length;
  return {
    analyzed_games: accs.length,
    typical_accuracy: Math.round(accs[Math.floor(accs.length / 2)]! * 10) / 10,
    this_game_accuracy: accuracy,
    this_game_better_than_pct_of_his_games: Math.round((below / accs.length) * 100),
  };
}

/** Every rule the review must follow that code can check. */
function problemsIn(out: GameReviewOutput, plies: Set<number>): string[] {
  const problems: string[] = [];
  const missing = [...plies].filter((p) => !out.moves.some((m) => m.ply === p));
  if (missing.length) problems.push(`missing notes for plies ${missing.join(", ")}`);
  if (out.story.length !== 2) problems.push("story must be exactly 2 paragraphs");
  if (out.fell_short.length < 2 || out.fell_short.length > 3) problems.push("fell_short must have 2 or 3 bullets");
  if (!/^your biggest mistake was .+, so work on .+/i.test(out.conclusion.trim())) problems.push('conclusion must read "Your biggest mistake was ..., so work on ..."');
  const summaryParts = [out.headline, ...out.story, out.momentum, ...out.fell_short, ...out.went_well, out.conclusion];
  for (const t of summaryParts) {
    const n = notationIn(t);
    if (n.length) problems.push(`summary uses notation (${n.join(", ")})`);
    for (const b of bannedIn(t)) problems.push(`summary ${b}: "${t.slice(0, 60)}"`);
    // The conclusion's fixed "Your biggest mistake was ..., so work on ..." shape needs a little more room.
    for (const s of longSentences(t, t === out.conclusion ? 30 : 24)) problems.push(`summary sentence too long: "${s.slice(0, 60)}..."`);
  }
  for (const m of out.moves) {
    const n = notationIn(m.note);
    if (n.length) problems.push(`ply ${m.ply} uses notation (${n.join(", ")})`);
    if (longSentences(m.note, 26).length) problems.push(`ply ${m.ply} note too long`);
  }
  return problems;
}

/**
 * Step 5: Arthur's review. One call writes the structured game summary and a
 * plain one-sentence note for every move (both sides), grounded in the
 * knowledge base sections for the patterns that came up. Notes go to
 * move_features (and the mistakes rows for flagged moves); the summary to
 * game_reviews. All text passes the house style (no dashes, short sentences).
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
  const knowledge = knowledgeFor({
    tags: mine.flatMap((r) => r.tags ?? []),
    causes: mine.map((r) => r.root_cause).filter((c): c is string => !!c),
    opening: game.opening_name,
    budget: 9000,
  });
  const input = {
    game: {
      he_played: game.my_color,
      opponent: game.opponent,
      ratings: { him: game.my_rating, opponent: game.opponent_rating },
      result_for_him: game.result,
      how_it_ended: describeEnding(game.result, game.result_detail).long,
      time_control: game.time_control,
      opening: game.opening_name,
      moves_played: game.move_count,
      his_accuracy: game.accuracy_ours,
      his_move_ratings: count(mine),
      opponent_move_ratings: count(feats.filter((r) => !r.features.mine)),
    },
    momentum: momentum(feats.map((r) => r.features)),
    compared_with_his_other_games: await history(db, gameId, game.accuracy_ours === null ? null : Number(game.accuracy_ours)),
    knowledge: knowledge.text,
    moves: feats.map((r) => plainMove(r.features, r.tags ?? [], { intent: r.intent, root_cause: r.root_cause, maia: maia.get(r.ply) ?? null })),
  };

  const system = `${COACH_VOICE}\n\n${GAME_REVIEW_TASK}`;
  let user = JSON.stringify(input);
  let out: GameReviewOutput | null = null;
  let model = env().CLAUDE_MODEL_REVIEW;
  const plies = new Set(feats.map((r) => r.ply));

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_REVIEW, system, user, schema: reviewSchema, effort: "medium", maxTokens: 16000 });
    // Dashes are fixed in code rather than retried for; everything else is checked.
    out = {
      ...res.data,
      headline: noDashes(res.data.headline),
      story: res.data.story.map(noDashes),
      momentum: noDashes(res.data.momentum),
      fell_short: res.data.fell_short.map(noDashes),
      went_well: res.data.went_well.map(noDashes),
      conclusion: noDashes(res.data.conclusion),
      moves: res.data.moves.map((m) => ({ ply: m.ply, note: noDashes(m.note) })),
    };
    model = res.model;
    const problems = problemsIn(out, plies);
    if (!problems.length) break;
    await logError("coach.review", new Error("review broke a rule"), { problems: problems.slice(0, 20), attempt }, gameId);
    if (attempt === 0) user = `${JSON.stringify(input)}\n\nYour previous answer broke these rules: ${problems.slice(0, 20).join("; ")}. Write it again following every rule.`;
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
  const summary: GameSummaryV3 = {
    version: 3,
    headline: out.headline,
    verdict: out.verdict,
    story: out.story,
    momentum: out.momentum,
    fell_short: out.fell_short,
    went_well: out.went_well,
    conclusion: out.conclusion,
    knowledge_used: out.knowledge_used.filter((id) => knowledge.ids.includes(id)),
  };
  const { error: revErr } = await db.from(T.game_reviews).upsert({ game_id: gameId, summary, model }, { onConflict: "game_id" });
  if (revErr) throw new Error(`save summary: ${revErr.message}`);
  await db.from(T.games).update({ analysis_status: "reviewed", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  return { notes: noteByPly.size, model };
}
