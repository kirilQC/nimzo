import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { buildFacts, type MoveFacts, type PositionInput } from "@/lib/analysis/facts";
import { buildFeatures, type EnginePosition, type MoveFeatures } from "@/lib/analysis/features";
import { isSeverity } from "@/lib/analysis/math";
import { jevClassify, JEV_MIN_PROBABILITY, type JevResult } from "@/lib/tags/jev";
import { TAG_BY_ID } from "@/lib/tags/catalog";
import type { MaiaFact } from "@/lib/tags/factsheet";
import { logError } from "@/lib/log";
import { saveGameAnalysis } from "@/lib/analysis/gameRow";

/**
 * Server steps of the resumable analysis state machine:
 *   imported -> engine_done -> facts_done -> (Maia in the browser) -> tagged -> reviewed
 * Each step is idempotent and short enough for a Vercel function.
 */

const POSITION_COLS = "ply, eval_cp, eval_mate, classification, best_move_san, best_move_uci, pv_san, multipv";

/**
 * Step 2: deterministic facts. Features and rule tags for every move (both
 * sides) go to move_features; the fuller fact sheet for each of my flagged
 * moves goes to mistakes. Replaces any earlier rows for the game.
 */
export async function runFactsStep(gameId: string): Promise<{ mistakes: number }> {
  const db = await getDb();
  const { data: game } = await db.from(T.games).select("pgn, my_color, source").eq("id", gameId).single();
  if (!game) throw new Error("game not found");
  const { data: positions, error } = await db.from(T.positions).select(POSITION_COLS).eq("game_id", gameId).order("ply");
  if (error) throw new Error(`load positions: ${error.message}`);

  const facts = buildFacts({ pgn: game.pgn, myColor: game.my_color, positions: (positions ?? []) as PositionInput[] });
  const features = buildFeatures({ pgn: game.pgn, myColor: game.my_color, positions: (positions ?? []) as EnginePosition[] });

  const { error: delF } = await db.from(T.move_features).delete().eq("game_id", gameId);
  if (delF) throw new Error(`clear move features: ${delF.message}`);
  const featureRows = features.map((f) => ({
    game_id: gameId,
    ply: f.ply,
    is_mine: f.mine,
    side: f.side,
    move_number: f.move_number,
    san: f.san,
    label: f.label,
    phase: f.phase,
    features: f,
    tags: f.rules,
  }));
  for (let i = 0; i < featureRows.length; i += 200) {
    const { error: e } = await db.from(T.move_features).insert(featureRows.slice(i, i + 200));
    if (e) throw new Error(`insert move features: ${e.message}`);
  }

  // Keep any Maia probabilities / tags already computed for unchanged plies? No: facts changed, so start clean.
  const { error: delErr } = await db.from(T.mistakes).delete().eq("game_id", gameId);
  if (delErr) throw new Error(`clear mistakes: ${delErr.message}`);
  if (facts.length) {
    const rows = facts.map((f) => ({
      game_id: gameId,
      ply: f.ply,
      source: game.source,
      classification: f.classification,
      facts: f,
      detectors: f.detectors,
      phase: f.phase,
    }));
    const { error: insErr } = await db.from(T.mistakes).insert(rows);
    if (insErr) throw new Error(`insert mistakes: ${insErr.message}`);
  }
  await db.from(T.games).update({ analysis_status: "facts_done", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  return { mistakes: facts.length };
}

/** What the browser needs to run Maia on each mistake. */
export async function mistakesForMaia(gameId: string) {
  const db = await getDb();
  const [{ data: mistakes }, { data: positions }, { data: settings }] = await Promise.all([
    db.from(T.mistakes).select("ply, facts").eq("game_id", gameId).order("ply"),
    db.from(T.positions).select("ply, best_move_uci").eq("game_id", gameId),
    db.from(T.settings).select("maia_default_elo").single(),
  ]);
  const best = new Map((positions ?? []).map((p) => [p.ply, p.best_move_uci as string | null]));
  return {
    elo: settings?.maia_default_elo ?? DEFAULT_MAIA_ELO,
    items: (mistakes ?? []).map((m) => {
      const f = m.facts as MoveFacts;
      return { ply: m.ply as number, fen_before: f.fen_before, played_uci: f.uci, best_uci: best.get(m.ply) ?? null };
    }),
  };
}

/** You told Nimzo you play like ~1000, so that's the default "your level". */
export const DEFAULT_MAIA_ELO = 1000;

export const maiaPayloadSchema = z.object({
  model: z.string().max(64),
  elo: z.number().int().min(100).max(3500),
  items: z
    .array(
      z.object({
        ply: z.number().int().min(1),
        p_played: z.number().min(0).max(1),
        p_best: z.number().min(0).max(1).nullable(),
        top: z.array(z.object({ uci: z.string().max(5), p: z.number() })).max(5),
      }),
    )
    .max(200),
});

export async function saveMaia(gameId: string, payload: z.infer<typeof maiaPayloadSchema>) {
  const db = await getDb();
  for (const it of payload.items) {
    const { error } = await db
      .from(T.mistakes)
      .update({ maia: { elo: payload.elo, model: payload.model, p_played: it.p_played, p_best: it.p_best, top: it.top } })
      .eq("game_id", gameId)
      .eq("ply", it.ply);
    if (error) throw new Error(`save maia: ${error.message}`);
  }
}

/** Moves of mine that Jev reads: everything except book moves and forced replies. */
function needsJev(f: MoveFeatures): boolean {
  return f.mine && f.label !== "book" && f.label !== "forced" && f.label !== null;
}

/** Confident tags for a move: every rule tag plus Jev tags it's sure about. */
export function mergeTags(rules: string[], jev: JevResult | null): string[] {
  const out = new Set(rules);
  for (const [id, p] of Object.entries(jev?.tags ?? {})) if (p >= JEV_MIN_PROBABILITY) out.add(id);
  return [...out];
}

/** The broad kind of mistake, from the tags (no model needed). */
export function mistakeType(f: MoveFeatures, tags: string[]): string {
  const groups = new Set(tags.map((t) => TAG_BY_ID.get(t)?.group));
  if (tags.includes("time_scramble") || tags.includes("instant_blunder")) return "time_management";
  if (groups.has("blunder") || groups.has("missed")) return "tactical";
  if (f.phase === "opening" && groups.has("opening")) return "opening";
  if (f.phase === "endgame") return "endgame_technique";
  return "positional";
}

/**
 * Step 4: Jev reads every one of my (non-book, non-forced) moves: why it was
 * played, the cause of each mistake, and the judgment tags that fit. Results go
 * to move_features; flagged moves also update their mistakes row.
 */
export async function runTagStep(gameId: string): Promise<{ tagged: number; failed: number; cost: number }> {
  const db = await getDb();
  const [{ data: rows, error }, { data: mistakes }] = await Promise.all([
    db.from(T.move_features).select("ply, features").eq("game_id", gameId).eq("is_mine", true).order("ply"),
    db.from(T.mistakes).select("id, ply, maia").eq("game_id", gameId),
  ]);
  if (error) throw new Error(`load move features: ${error.message}`);
  const maia = new Map((mistakes ?? []).map((m) => [m.ply as number, (m.maia as MaiaFact) ?? null]));
  const mistakeId = new Map((mistakes ?? []).map((m) => [m.ply as number, m.id as string]));

  const queue = (rows ?? []).map((r) => r.features as MoveFeatures).filter(needsJev);
  let failed = 0, cost = 0;
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      let jev: JevResult | null = null;
      try {
        jev = await jevClassify(f, maia.get(f.ply) ?? null);
        cost += jev.usage?.cost ?? 0;
      } catch (e) {
        failed++;
        await logError("jev", e, { ply: f.ply }, gameId);
      }
      const tags = mergeTags(f.rules, jev);
      const { error: e1 } = await db
        .from(T.move_features)
        .update({ tags, jev, intent: jev?.intent?.value ?? null, root_cause: jev?.root_cause?.value ?? null })
        .eq("game_id", gameId)
        .eq("ply", f.ply);
      if (e1) throw new Error(`save move tags: ${e1.message}`);
      const mid = mistakeId.get(f.ply);
      if (mid && isSeverity(f.label)) {
        const bad = tags.filter((t) => TAG_BY_ID.get(t)?.polarity === "bad");
        const { error: e2 } = await db
          .from(T.mistakes)
          .update({
            tags: { version: 2, rules: f.rules, jev, merged: tags },
            motifs: bad,
            mistake_type: mistakeType(f, tags),
            root_cause: (jev?.root_cause?.confidence ?? 0) >= 0.5 ? jev!.root_cause!.value : null,
            phase: f.phase,
          })
          .eq("id", mid);
        if (e2) throw new Error(`save mistake tags: ${e2.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  await db.from(T.games).update({ analysis_status: "tagged", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  await saveGameAnalysis(gameId).catch((e) => logError("analysis.row", e, {}, gameId));
  return { tagged: (rows ?? []).length, failed, cost };
}

export async function failGame(gameId: string, scope: string, e: unknown) {
  const db = await getDb();
  await logError(scope, e, {}, gameId);
  await db.from(T.games).update({ analysis_status: "failed", analysis_error: (e as Error).message }).eq("id", gameId);
}
