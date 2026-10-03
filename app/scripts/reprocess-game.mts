// Re-runs features, tagging (Jev) and Arthur's review for one already-analyzed game, without the engine.
// Usage (from app/): NIMZO_SCRIPT=1 npx tsx --conditions=react-server --env-file=.env.local scripts/reprocess-game.mts <game id>
import { createClient } from "@supabase/supabase-js";
import { buildFeatures } from "../src/lib/analysis/features";
import { runTagStep } from "../src/lib/pipeline";
import { runReviewStep } from "../src/lib/coach/review";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!);
const id = process.argv[2] ?? "439d97cc-3abd-476c-b3b9-6ee0ca9eafad";
const { data: g } = await db.from("nimzo_games").select("pgn, my_color").eq("id", id).single();
const { data: pos } = await db.from("nimzo_positions").select("ply, eval_cp, eval_mate, classification, best_move_uci, best_move_san, pv_san").eq("game_id", id).order("ply");
const feats = buildFeatures({ pgn: g!.pgn, myColor: g!.my_color, positions: pos as never });
for (const f of feats) await db.from("nimzo_move_features").update({ features: f, tags: f.rules }).eq("game_id", id).eq("ply", f.ply);
const t0 = Date.now();
console.log("tag", await runTagStep(id), ((Date.now() - t0) / 1000).toFixed(0) + "s");
const t1 = Date.now();
console.log("review", await runReviewStep(id), ((Date.now() - t1) / 1000).toFixed(0) + "s");
const { data: r } = await db.from("nimzo_game_reviews").select("summary").eq("game_id", id).single();
console.log(JSON.stringify(r!.summary, null, 1));
const { data: notes } = await db.from("nimzo_move_features").select("ply, san, label, note, tags, jev").eq("game_id", id).eq("is_mine", true).order("ply");
for (const n of notes ?? []) console.log(`${Math.ceil(n.ply / 2)}. ${n.san.padEnd(6)} ${String(n.label).padEnd(10)} ${n.note}\n      tags: ${(n.tags ?? []).join(", ")}${n.jev?.principle ? `\n      principle: ${n.jev.principle.value}  category: ${n.jev.category?.value}` : ""}`);
const { data: errs } = await db.from("nimzo_error_log").select("scope, message, context").gte("created_at", new Date(t0).toISOString());
console.log("errors", JSON.stringify(errs));
