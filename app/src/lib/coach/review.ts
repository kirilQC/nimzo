import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";
import { formatLine } from "@/lib/chess/lines";
import { pgnToPositions } from "@/lib/chess/pgn";
import type { MoveFacts } from "@/lib/analysis/facts";
import { motifLabel, tagLabel } from "@/lib/taxonomy";
import { structuredCall } from "./claude";
import { COACH_VOICE, GAME_REVIEW_TASK } from "./prompts";
import { sanSet, unknownMoves } from "./guard";

const reviewSchema = z.object({
  explanations: z.array(z.object({ ply: z.number().int(), text: z.string() })),
  summary: z.object({ key_moment: z.string(), went_well: z.string(), work_on: z.string() }),
});
export type GameReviewOutput = z.infer<typeof reviewSchema>;

type MistakeRow = {
  id: string;
  ply: number;
  facts: MoveFacts;
  tags: { mistake_type?: { value: string; confidence: number | null }; root_cause?: { value: string; confidence: number | null }; motifs?: Record<string, { value: boolean; confidence: number | null }> } | null;
  maia: { elo: number; p_played: number; p_best: number | null } | null;
};

function mistakeForPrompt(m: MistakeRow, minConf: number) {
  const f = m.facts;
  const motifs = Object.entries(m.tags?.motifs ?? {})
    .filter(([, v]) => v.value && (v.confidence ?? 1) >= minConf)
    .map(([id]) => motifLabel(id));
  const rc = m.tags?.root_cause;
  return {
    ply: m.ply,
    move: `${f.move_number}${f.side === "white" ? "." : "..."} ${f.san}`,
    severity: f.classification,
    phase: f.phase,
    eval_before_white_pov: f.eval_before,
    eval_after_white_pov: f.eval_after,
    win_chance_before_pct: f.win_pct_before,
    win_chance_after_pct: f.win_pct_after,
    engine_preferred: f.engine_best,
    other_good_moves: f.alternatives,
    opponent_best_reply: f.opponent_best_reply,
    moved_piece: f.move.piece,
    capture: f.move.capture,
    clock: f.clock,
    material_player_pov: f.material,
    previous_moves: f.previous_moves,
    detectors: Object.entries(f.detectors).filter(([, v]) => v).map(([k]) => k),
    tags: {
      mistake_type: m.tags?.mistake_type && (m.tags.mistake_type.confidence ?? 0) >= minConf ? tagLabel("mistake_type", m.tags.mistake_type.value) : "unclear",
      root_cause: rc && (rc.confidence ?? 0) >= minConf ? tagLabel("root_cause", rc.value) : "unclear",
      motifs,
    },
    players_at_your_level_who_play_this: m.maia ? `${Math.round(m.maia.p_played * 100)}%` : null,
    players_at_your_level_who_find_engine_move: m.maia?.p_best != null ? `${Math.round(m.maia.p_best * 100)}%` : null,
  };
}

function allowedMoves(m: MistakeRow): Set<string> {
  const f = m.facts;
  return sanSet([
    f.san,
    f.engine_best.san,
    f.engine_best.line,
    f.opponent_best_reply.san,
    f.opponent_best_reply.line,
    ...f.alternatives.flatMap((a) => [a.san, a.line]),
    ...f.previous_moves.map((p) => p.move),
  ]);
}

/** Step 5: Claude explanations for each flagged move plus a game summary. Status -> reviewed. */
export async function runReviewStep(gameId: string): Promise<{ explained: number; model: string }> {
  const db = await getDb();
  const [{ data: game }, { data: mistakes }, { data: settings }] = await Promise.all([
    db.from(T.games).select("pgn, my_color, opponent, result, result_detail, time_class, time_control, opening_name, accuracy_ours, blunders, mistakes, inaccuracies").eq("id", gameId).single(),
    db.from(T.mistakes).select("id, ply, facts, tags, maia").eq("game_id", gameId).order("ply"),
    db.from(T.settings).select("thresholds").single(),
  ]);
  if (!game) throw new Error("game not found");
  const minConf = Number((settings?.thresholds as { jev_min_confidence?: number } | null)?.jev_min_confidence ?? 0.6);
  const rows = (mistakes ?? []) as MistakeRow[];
  const plies = pgnToPositions(game.pgn).plies;
  const moveList = plies.map((p) => formatLine(p.ply, [p.san])).join(" ");

  const input = {
    game: {
      player_color: game.my_color,
      opponent: game.opponent,
      result_for_player: game.result,
      how_it_ended: game.result_detail,
      time_control: game.time_control,
      opening: game.opening_name,
      accuracy: game.accuracy_ours,
      flags: { blunders: game.blunders, mistakes: game.mistakes, inaccuracies: game.inaccuracies },
      moves: moveList,
    },
    flagged_moves: rows.map((m) => mistakeForPrompt(m, minConf)),
  };

  const allowedGame = sanSet([moveList]);
  const system = `${COACH_VOICE}\n\n${GAME_REVIEW_TASK}`;
  let user = JSON.stringify(input);
  let out: GameReviewOutput | null = null;
  let model = env().CLAUDE_MODEL_REVIEW;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_REVIEW, system, user, schema: reviewSchema, effort: "medium" });
    out = res.data;
    model = res.model;
    const problems: string[] = [];
    for (const e of out.explanations) {
      const m = rows.find((r) => r.ply === e.ply);
      if (!m) continue;
      const bad = unknownMoves(e.text, allowedMoves(m));
      if (bad.length) problems.push(`ply ${e.ply}: ${bad.join(", ")}`);
    }
    const summaryText = Object.values(out.summary).join(" ");
    const badSummary = unknownMoves(summaryText, new Set([...allowedGame, ...rows.flatMap((r) => [...allowedMoves(r)])]));
    if (badSummary.length) problems.push(`summary: ${badSummary.join(", ")}`);
    if (!problems.length) break;
    await logError("coach.guard", new Error("moves not in facts"), { problems, attempt }, gameId);
    if (attempt === 0) {
      user = `${JSON.stringify(input)}\n\nYour previous answer mentioned moves that are not in the data (${problems.join("; ")}). Rewrite it using only moves from the data.`;
    }
  }
  if (!out) throw new Error("no review produced");

  for (const e of out.explanations) {
    const m = rows.find((r) => r.ply === e.ply);
    if (!m) continue;
    const { error } = await db.from(T.mistakes).update({ explanation: e.text.trim(), explanation_model: model }).eq("id", m.id);
    if (error) throw new Error(`save explanation: ${error.message}`);
  }
  const { error: revErr } = await db.from(T.game_reviews).upsert({ game_id: gameId, summary: out.summary, model }, { onConflict: "game_id" });
  if (revErr) throw new Error(`save summary: ${revErr.message}`);
  await db.from(T.games).update({ analysis_status: "reviewed", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  return { explained: out.explanations.length, model };
}
