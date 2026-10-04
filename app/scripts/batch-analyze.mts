// Analyzes many games on this PC: Stockfish (depth 16, the same WebAssembly
// build the browser uses) on many cores, then facts, Maia, Jev tags and the
// per-game analysis row. Arthur's written review only for the newest N games.
// Resumable: re-running skips games that are already done.
//
// Usage (from app/):
//   NIMZO_SCRIPT=1 npx tsx --conditions=react-server --env-file=.env.local scripts/batch-analyze.mts \
//     --class rapid --limit 905 --reviews 100 --workers 14 [--dry]
//
// Fair play: this only reads finished games already imported from chess.com.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeEngine } from "../src/lib/analysis/nodeEngine";
import { DEFAULT_DEPTH, runEngineAnalysis } from "../src/lib/analysis/runGame";
import { saveEngineResults, mistakesForMaia, saveMaia, runFactsStep, runTagStep, failGame } from "../src/lib/pipeline";
import { runReviewStep } from "../src/lib/coach/review";
import { claudeUsage } from "../src/lib/coach/claude";
import { PIPELINE_VERSION } from "../src/lib/analysis/gameRow";
import { predict, type OrtLike, type SessionLike } from "../src/lib/maia/encode";
import { pgnToPositions } from "../src/lib/chess/pgn";

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : def;
};
const TIME_CLASS = arg("class", "rapid");
const LIMIT = Number(arg("limit", "905"));
const REVIEWS = Number(arg("reviews", "100"));
const WORKERS = Number(arg("workers", "14"));
const DRY = process.argv.includes("--dry");
const REVIEW_CONCURRENCY = 3;
process.env.JEV_CONCURRENCY ??= "3";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
const LOG_DIR = fileURLToPath(new URL("../.batch/", import.meta.url));
mkdirSync(LOG_DIR, { recursive: true });
const LOG = `${LOG_DIR}batch-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const log = (o: object) => appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...o }) + "\n");

// ---- Which games ----
type Game = { id: string; pgn: string; my_color: "white" | "black"; analysis_status: string; end_time: string };
const games: Game[] = [];
for (let from = 0; games.length < LIMIT; from += 1000) {
  const { data, error } = await db
    .from("nimzo_games")
    .select("id, pgn, my_color, analysis_status, end_time")
    .eq("time_class", TIME_CLASS)
    .order("end_time", { ascending: false })
    .range(from, from + 999);
  if (error) throw error;
  games.push(...((data ?? []) as Game[]));
  if (!data || data.length < 1000) break;
}
games.splice(LIMIT);
const reviewIds = new Set(games.slice(0, REVIEWS).map((g) => g.id));

const rowVersion = new Map<string, number>();
for (let i = 0; i < games.length; i += 150) {
  const { data: rows, error } = await db.from("nimzo_game_analysis").select("game_id, pipeline_version").in("game_id", games.slice(i, i + 150).map((g) => g.id));
  if (error) throw error;
  for (const r of rows ?? []) rowVersion.set(r.game_id as string, r.pipeline_version as number);
}
const done = (g: Game) => (rowVersion.get(g.id) ?? 0) >= PIPELINE_VERSION && (!reviewIds.has(g.id) || g.analysis_status === "reviewed");
const todo = games.filter((g) => !done(g));
console.log(`${games.length} ${TIME_CLASS} games; ${games.length - todo.length} already done; ${todo.length} to do (${todo.filter((g) => reviewIds.has(g.id)).length} with Arthur's review). Log: ${LOG}`);
if (DRY) process.exit(0);

// ---- Maia, shared by all workers ----
const ort = (await import("onnxruntime-web")) as unknown as OrtLike & { env: { wasm: { numThreads: number } }; InferenceSession: { create(b: Uint8Array, o: object): Promise<SessionLike> } };
ort.env.wasm.numThreads = 1;
const maiaSession = await ort.InferenceSession.create(readFileSync(fileURLToPath(new URL("../public/maia/maia3_simplified.onnx", import.meta.url))), { executionProviders: ["wasm"] });
let maiaChain: Promise<unknown> = Promise.resolve();
const maiaPredict = (fen: string, elo: number) => {
  const p = maiaChain.then(() => predict(ort, maiaSession, fen, elo, elo));
  maiaChain = p.catch(() => undefined);
  return p;
};

// ---- Simple semaphore for Arthur's reviews ----
let reviewSlots = REVIEW_CONCURRENCY;
const waiting: (() => void)[] = [];
const acquire = () => (reviewSlots > 0 ? (reviewSlots--, Promise.resolve()) : new Promise<void>((r) => waiting.push(r)));
const release = () => (waiting.length ? waiting.shift()!() : reviewSlots++);

// ---- One game ----
async function positionsComplete(g: Game): Promise<boolean> {
  const { count } = await db.from("nimzo_positions").select("*", { count: "exact", head: true }).eq("game_id", g.id);
  return (count ?? 0) === pgnToPositions(g.pgn).plies.length + 1;
}

async function analyze(g: Game, engine: NodeEngine) {
  const t0 = Date.now();
  const steps: string[] = [];
  const needsEngine = ["imported", "failed"].includes(g.analysis_status) || !(await positionsComplete(g));
  if (needsEngine) {
    const payload = await runEngineAnalysis({ pgn: g.pgn, myColor: g.my_color, engine, depth: DEFAULT_DEPTH });
    await saveEngineResults(g.id, payload);
    steps.push("engine");
  } else {
    await runFactsStep(g.id); // rebuild facts and move features with the current rules
    steps.push("facts");
  }
  const { elo, items } = await mistakesForMaia(g.id);
  if (items.length) {
    const out = [];
    for (const it of items) {
      const r = await maiaPredict(it.fen_before, elo);
      out.push({ ply: it.ply, p_played: r.policy[it.played_uci] ?? 0, p_best: it.best_uci ? (r.policy[it.best_uci] ?? 0) : null, top: Object.entries(r.policy).slice(0, 5).map(([uci, p]) => ({ uci, p })) });
    }
    await saveMaia(g.id, { model: "maia3_simplified", elo, items: out });
    steps.push("maia");
  }
  const tag = await runTagStep(g.id);
  steps.push("jev");
  if (reviewIds.has(g.id)) {
    await acquire();
    try {
      await runReviewStep(g.id);
      steps.push("review");
    } finally {
      release();
    }
  }
  return { secs: Math.round((Date.now() - t0) / 1000), steps, jev: tag.cost, jevFailed: tag.failed };
}

// ---- Run ----
const start = Date.now();
let finished = 0, failed = 0, jevCost = 0;
const queue = [...todo];
const opusCost = () => (claudeUsage.input * 4 + claudeUsage.cacheWrite * 5 + claudeUsage.cacheRead * 0.4 + claudeUsage.output * 20) / 1e6;

async function worker(n: number) {
  const engine = new NodeEngine();
  await engine.init();
  for (let g = queue.shift(); g; g = queue.shift()) {
    try {
      const r = await analyze(g, engine);
      finished++;
      jevCost += r.jev;
      log({ game: g.id, end: g.end_time, ok: true, ...r });
      const elapsed = (Date.now() - start) / 1000;
      const eta = ((elapsed / (finished + failed)) * queue.length) / 60;
      console.log(
        `[${finished + failed}/${todo.length}] w${n} ${g.end_time.slice(0, 10)} ${r.steps.join("+")} ${r.secs}s | Jev $${jevCost.toFixed(3)} Opus $${opusCost().toFixed(2)} | ~${eta.toFixed(0)} min left`,
      );
    } catch (e) {
      failed++;
      log({ game: g.id, ok: false, error: (e as Error).message });
      console.log(`[${finished + failed}/${todo.length}] w${n} FAILED ${g.id}: ${(e as Error).message}`);
      await failGame(g.id, "batch", e).catch(() => undefined);
    }
  }
  engine.quit();
}
await Promise.all(Array.from({ length: Math.min(WORKERS, todo.length) }, (_, i) => worker(i + 1)));

const mins = ((Date.now() - start) / 60000).toFixed(1);
const reviews = todo.filter((g) => reviewIds.has(g.id)).length;
const summary = {
  done: finished,
  failed,
  minutes: Number(mins),
  jev_cost: Number(jevCost.toFixed(4)),
  opus: { ...claudeUsage, cost: Number(opusCost().toFixed(3)), per_review: reviews ? Number((opusCost() / reviews).toFixed(3)) : null },
};
log({ summary });
console.log("\nSUMMARY", JSON.stringify(summary, null, 1));
process.exit(0);
