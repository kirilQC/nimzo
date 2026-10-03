// Usage (from app/): npx tsx --conditions=react-server --env-file=.env.local scripts/calibrate-jev.mts [N]
// Grades Jev's yes/no judgment tags against Opus on a sample of flagged moves; picks the probability cutoff.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { buildFeatures, type MoveFeatures } from "../src/lib/analysis/features";
import { isSeverity } from "../src/lib/analysis/math";
import { jevClassify, questionsFor } from "../src/lib/tags/jev";
import { factSheet } from "../src/lib/tags/factsheet";
import { structuredCall } from "../src/lib/coach/claude";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!);
const OUT = "../calibration/jev-vs-opus.json"; // saved answers; delete to regrade from scratch
const N = Number(process.argv[2] ?? 60);
type Item = { game: string; ply: number; san: string; label: string; jev: Record<string, number>; opus: Record<string, boolean> };
const done: Item[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];

if (done.length < N) {
  const { data: games } = await db.from("nimzo_games").select("id, pgn, my_color").in("analysis_status", ["reviewed", "tagged"]).limit(40);
  const pool: { game: string; f: MoveFeatures }[] = [];
  for (const g of games ?? []) {
    const { data: pos } = await db.from("nimzo_positions").select("ply, eval_cp, eval_mate, classification, best_move_uci, best_move_san, pv_san").eq("game_id", g.id).order("ply");
    for (const f of buildFeatures({ pgn: g.pgn, myColor: g.my_color, positions: pos as never })) if (f.mine && isSeverity(f.label)) pool.push({ game: g.id, f });
  }
  // Spread across games: round-robin.
  pool.sort((a, b) => (a.f.ply % 7) - (b.f.ply % 7) || a.game.localeCompare(b.game));
  const todo = pool.filter((p) => !done.some((d) => d.game === p.game && d.ply === p.f.ply)).slice(0, N - done.length);
  console.log("pool", pool.length, "todo", todo.length);
  const work = async (p: { game: string; f: MoveFeatures }) => {
    const qs = questionsFor(p.f);
    const jev = await jevClassify(p.f, null);
    const schema = z.object({ answers: z.object(Object.fromEntries(qs.map((q) => [q.id, z.boolean()]))) });
    const system = "You are a strong chess coach grading tags on a beginner's move. You get verified facts about the move (computed by code and an engine; trust them) and a list of tags. For each tag answer true only if the facts clearly show it applies to this move, false otherwise. Be strict: when in doubt, false.";
    const user = JSON.stringify({ facts: factSheet(p.f, null), tags: qs.map((q) => ({ id: q.id, label: q.label, meaning: q.criteria ?? q.plain })) });
    const { data } = await structuredCall({ model: "claude-opus-5-5", system, user, schema, effort: "medium", maxTokens: 4000 });
    done.push({ game: p.game, ply: p.f.ply, san: p.f.san, label: p.f.label!, jev: jev.tags, opus: data.answers as Record<string, boolean> });
    writeFileSync(OUT, JSON.stringify(done, null, 1));
    process.stdout.write(".");
  };
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(work));
  console.log();
}

// Score thresholds.
const pairs: { tag: string; p: number; y: boolean }[] = [];
for (const d of done) for (const [tag, y] of Object.entries(d.opus)) if (d.jev[tag] !== undefined) pairs.push({ tag, p: d.jev[tag]!, y });
const base = pairs.filter((x) => x.y).length / pairs.length;
console.log(`moves ${done.length}, tag answers ${pairs.length}, Opus says yes ${(base * 100).toFixed(1)}%`);
for (const th of [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of pairs) { const q = x.p >= th; if (q && x.y) tp++; else if (q) fp++; else if (x.y) fn++; else tn++; }
  const P = tp / (tp + fp || 1), R = tp / (tp + fn || 1);
  console.log(`cutoff ${th}: precision ${(P * 100).toFixed(0)}% recall ${(R * 100).toFixed(0)}% F1 ${((2 * P * R) / (P + R || 1) * 100).toFixed(0)} agree ${(((tp + tn) / pairs.length) * 100).toFixed(1)}%  jev-yes ${tp + fp} opus-yes ${tp + fn}`);
}
// Per tag at 0.8
const byTag = new Map<string, { tp: number; fp: number; fn: number; n: number }>();
for (const x of pairs) { const s = byTag.get(x.tag) ?? { tp: 0, fp: 0, fn: 0, n: 0 }; s.n++; const q = x.p >= 0.8; if (q && x.y) s.tp++; else if (q) s.fp++; else if (x.y) s.fn++; byTag.set(x.tag, s); }
console.log("\nper tag at 0.8 (tp/fp/fn of n):");
for (const [t, s] of [...byTag].sort((a, b) => b[1].fp - a[1].fp).slice(0, 25)) console.log(`  ${t.padEnd(28)} ${s.tp}/${s.fp}/${s.fn} of ${s.n}`);

// Re-score with the current gates (gated-out questions count as "no") using the saved answers.
{
  const { questionsFor } = await import("../src/lib/tags/jev");
  const feats = new Map<string, MoveFeatures>();
  for (const gid of [...new Set(done.map((d) => d.game))]) {
    const { data: g } = await db.from("nimzo_games").select("pgn, my_color").eq("id", gid).single();
    const { data: pos } = await db.from("nimzo_positions").select("ply, eval_cp, eval_mate, classification, best_move_uci, best_move_san, pv_san").eq("game_id", gid).order("ply");
    for (const f of buildFeatures({ pgn: g!.pgn, myColor: g!.my_color, positions: pos as never })) feats.set(`${gid}:${f.ply}`, f);
  }
  for (const th of [0.7, 0.75, 0.8, 0.85, 0.9]) {
    let tp = 0, fp = 0, fn = 0;
    for (const d of done) {
      const asked = new Set(questionsFor(feats.get(`${d.game}:${d.ply}`)!).map((q) => q.id));
      for (const [tag, y] of Object.entries(d.opus)) { const q = asked.has(tag) && (d.jev[tag] ?? 0) >= th; if (q && y) tp++; else if (q) fp++; else if (y) fn++; }
    }
    const P = tp / (tp + fp || 1), R = tp / (tp + fn || 1);
    console.log(`GATED cutoff ${th}: precision ${(P * 100).toFixed(0)}% recall ${(R * 100).toFixed(0)}% F1 ${((2 * P * R) / (P + R || 1) * 100).toFixed(0)}  jev-yes ${tp + fp}`);
  }
}
