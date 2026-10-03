import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { buildFacts, type MoveFacts, type PositionInput } from "@/lib/analysis/facts";
import { classifyMistake, confidentMotifs } from "@/lib/classifier";
import type { MaiaInfo } from "@/lib/classifier/types";
import { logError } from "@/lib/log";

/**
 * Server steps of the resumable analysis state machine:
 *   imported -> engine_done -> facts_done -> (Maia in the browser) -> tagged -> reviewed
 * Each step is idempotent and short enough for a Vercel function.
 */

const POSITION_COLS = "ply, eval_cp, eval_mate, classification, best_move_san, best_move_uci, pv_san, multipv";

/** Step 2: deterministic facts for each of my flagged moves. Replaces the game's mistake rows. */
export async function runFactsStep(gameId: string): Promise<{ mistakes: number }> {
  const db = await getDb();
  const { data: game } = await db.from(T.games).select("pgn, my_color, source").eq("id", gameId).single();
  if (!game) throw new Error("game not found");
  const { data: positions, error } = await db.from(T.positions).select(POSITION_COLS).eq("game_id", gameId).order("ply");
  if (error) throw new Error(`load positions: ${error.message}`);

  const facts = buildFacts({ pgn: game.pgn, myColor: game.my_color, positions: (positions ?? []) as PositionInput[] });

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

/** Step 4: classify every mistake (Jev, falling back to Claude), then mark the game tagged. */
export async function runTagStep(gameId: string): Promise<{ tagged: number; fallback: number }> {
  const db = await getDb();
  const [{ data: mistakes }, { data: settings }] = await Promise.all([
    db.from(T.mistakes).select("id, ply, facts, maia").eq("game_id", gameId),
    db.from(T.settings).select("thresholds").single(),
  ]);
  const minConf = Number((settings?.thresholds as { jev_min_confidence?: number } | null)?.jev_min_confidence ?? 0.6);

  let fallback = 0;
  const queue = [...(mistakes ?? [])];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const tags = await classifyMistake({ facts: m.facts as MoveFacts, maia: (m.maia as MaiaInfo) ?? null }, gameId);
      if (tags.mistake_type.source === "fallback") fallback++;
      const confident = (t: { value: string; confidence: number | null }) => ((t.confidence ?? 0) >= minConf ? t.value : null);
      const { raw, overridden, ...stored } = tags;
      const { error } = await db
        .from(T.mistakes)
        .update({
          tags: { ...stored, overridden, provider_raw: raw ?? null },
          motifs: confidentMotifs(tags, minConf),
          mistake_type: confident(tags.mistake_type),
          root_cause: confident(tags.root_cause),
          phase: tags.phase.value,
        })
        .eq("id", m.id);
      if (error) throw new Error(`save tags: ${error.message}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await db.from(T.games).update({ analysis_status: "tagged", analysis_updated_at: new Date().toISOString() }).eq("id", gameId);
  return { tagged: mistakes?.length ?? 0, fallback };
}

export async function failGame(gameId: string, scope: string, e: unknown) {
  const db = await getDb();
  await logError(scope, e, {}, gameId);
  await db.from(T.games).update({ analysis_status: "failed", analysis_error: (e as Error).message }).eq("id", gameId);
}
