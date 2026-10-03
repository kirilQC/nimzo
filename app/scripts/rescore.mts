// Re-scores already-analyzed games from their stored evals after the label
// thresholds or accuracy formula change. No engine re-run needed.
// Usage (from app/): node --env-file=.env.local scripts/rescore.mts [--dry]
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { THRESHOLDS, gameAccuracy, judgeMove, type Score } from "../src/lib/analysis/math.ts";

const dry = process.argv.includes("--dry");
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!, { auth: { persistSession: false } });

type Pos = { ply: number; fen: string; uci: string | null; is_mine: boolean; eval_cp: number | null; eval_mate: number | null; best_move_uci: string | null; classification: string | null; accuracy: number | null };
const score = (p: Pos): Score => (p.eval_mate !== null ? { mate: p.eval_mate } : { cp: p.eval_cp ?? 0 });

// Keep the stored settings in step with the new defaults (engine depth etc. untouched).
const { data: settings } = await db.from("nimzo_settings").select("id, thresholds").single();
const nextThresholds = { ...(settings!.thresholds as object), ...THRESHOLDS };
if (!dry) {
  const { error } = await db.from("nimzo_settings").update({ thresholds: nextThresholds }).eq("id", settings!.id);
  if (error) throw error;
}
console.log("settings.thresholds ->", JSON.stringify(nextThresholds));

const { data: games, error } = await db
  .from("nimzo_games")
  .select("id, accuracy_ours, blunders, mistakes, inaccuracies, analysis_status")
  .in("analysis_status", ["engine_done", "facts_done", "tagged", "reviewed"]);
if (error) throw error;

let removed = 0, relabeled = 0, changedGames = 0;
for (const g of games!) {
  const { data: pos } = await db.from("nimzo_positions").select("ply, fen, uci, is_mine, eval_cp, eval_mate, best_move_uci, classification, accuracy").eq("game_id", g.id).order("ply");
  const list = (pos ?? []) as Pos[];
  if (list.length < 2) continue;
  const accs: number[] = [];
  const totals = { blunders: 0, mistakes: 0, inaccuracies: 0 };
  const updates: { ply: number; classification: string; accuracy: number }[] = [];
  const flagged = new Map<number, string>();
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]!, p = list[i]!;
    const mover = new Chess(prev.fen).turn();
    const j = judgeMove({ before: score(prev), after: score(p), mover, playedBest: p.best_move_uci === p.uci, deliversMate: new Chess(p.fen).isCheckmate() });
    const acc = Math.round(j.accuracy * 100) / 100;
    if (j.classification !== p.classification || Number(p.accuracy) !== acc) updates.push({ ply: p.ply, classification: j.classification, accuracy: acc });
    if (p.is_mine) {
      accs.push(j.accuracy);
      if (j.classification === "blunder") totals.blunders++;
      else if (j.classification === "mistake") totals.mistakes++;
      else if (j.classification === "inaccuracy") totals.inaccuracies++;
      if (["blunder", "mistake", "inaccuracy"].includes(j.classification)) flagged.set(p.ply, j.classification);
    }
  }
  const a = gameAccuracy(accs);
  const accuracy_ours = a === null ? null : Math.round(a * 100) / 100;

  const { data: mistakes } = await db.from("nimzo_mistakes").select("id, ply, classification, facts").eq("game_id", g.id);
  const drop = (mistakes ?? []).filter((m) => !flagged.has(m.ply));
  const relabel = (mistakes ?? []).filter((m) => flagged.has(m.ply) && flagged.get(m.ply) !== m.classification);
  removed += drop.length;
  relabeled += relabel.length;
  changedGames++;
  console.log(`${g.id.slice(0, 8)} acc ${g.accuracy_ours} -> ${accuracy_ours} | B/M/I ${g.blunders}/${g.mistakes}/${g.inaccuracies} -> ${totals.blunders}/${totals.mistakes}/${totals.inaccuracies} | drop ${drop.length} relabel ${relabel.length}`);
  if (dry) continue;

  for (const u of updates) {
    const r = await db.from("nimzo_positions").update({ classification: u.classification, accuracy: u.accuracy }).eq("game_id", g.id).eq("ply", u.ply);
    if (r.error) throw r.error;
  }
  if (drop.length) {
    const r = await db.from("nimzo_mistakes").delete().in("id", drop.map((m) => m.id));
    if (r.error) throw r.error;
  }
  for (const m of relabel) {
    const cls = flagged.get(m.ply)!;
    const r = await db.from("nimzo_mistakes").update({ classification: cls, facts: { ...(m.facts as object), classification: cls } }).eq("id", m.id);
    if (r.error) throw r.error;
  }
  const r = await db.from("nimzo_games").update({ accuracy_ours, ...totals }).eq("id", g.id);
  if (r.error) throw r.error;
}
console.log(`${dry ? "[dry] " : ""}${changedGames} games, ${removed} mistake rows removed, ${relabeled} relabeled`);
