import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { describeEnding } from "@/lib/chess/ending";
import { TAG_BY_ID } from "@/lib/tags/catalog";
import type { JevResult } from "@/lib/tags/jev";
import type { MoveFeatures } from "./features";
import { gameAccuracy } from "./math";

/** Bump when the row's meaning changes, so old rows can be found and rebuilt. */
export const PIPELINE_VERSION = 3;

type MF = { ply: number; is_mine: boolean; label: string | null; phase: string | null; features: MoveFeatures; tags: string[] | null; jev: JevResult | null };

const ERR = new Set(["inaccuracy", "mistake", "miss", "blunder"]);
const BIG = new Set(["mistake", "miss", "blunder"]);
const count = <T extends string>(xs: (T | null | undefined)[]) => xs.reduce<Record<string, number>>((m, x) => (x ? ((m[x] = (m[x] ?? 0) + 1), m) : m), {});
const r1 = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);

/**
 * Builds and saves the one-row summary of an analyzed game (nimzo_game_analysis)
 * from its stored positions, move features, tags, Maia data and Arthur's review.
 */
export async function saveGameAnalysis(gameId: string): Promise<void> {
  const db = await getDb();
  const [{ data: g }, { data: pos }, { data: mfRows }, { data: mistakes }, { data: review }] = await Promise.all([
    db.from(T.games).select("*").eq("id", gameId).single(),
    db.from(T.positions).select("ply, accuracy, is_mine").eq("game_id", gameId).order("ply"),
    db.from(T.move_features).select("ply, is_mine, label, phase, features, tags, jev").eq("game_id", gameId).order("ply"),
    db.from(T.mistakes).select("ply, maia").eq("game_id", gameId),
    db.from(T.game_reviews).select("summary").eq("game_id", gameId).maybeSingle(),
  ]);
  if (!g) throw new Error("game not found");
  const mf = (mfRows ?? []) as MF[];
  if (!mf.length) return; // not analyzed yet

  const mine = mf.filter((m) => m.is_mine);
  const theirs = mf.filter((m) => !m.is_mine);
  const labels = count(mine.map((m) => m.label));
  const oppLabels = count(theirs.map((m) => m.label));
  const accByPly = new Map((pos ?? []).map((p) => [p.ply as number, p.accuracy === null ? null : Number(p.accuracy)]));
  const accFor = (rows: MF[]) => {
    const a = rows.map((m) => accByPly.get(m.ply)).filter((x): x is number => x !== null && x !== undefined);
    const v = gameAccuracy(a);
    return v === null ? null : Math.round(v * 100) / 100;
  };
  const errs = mine.filter((m) => ERR.has(m.label ?? ""));
  const byPhase = (phase: string, set: Set<string>) => mine.filter((m) => m.phase === phase && set.has(m.label ?? "")).length;
  const blunderSet = new Set(["blunder"]);
  const drops = mine.map((m) => ({ move: m.features.move_number, d: m.features.win_lost }));
  const biggest = drops.reduce<{ move: number; d: number } | null>((a, b) => (!a || b.d > a.d ? b : a), null);

  // Momentum, from my side.
  const pts = mf.map((m) => ({ move: m.features.move_number, w: m.is_mine ? m.features.win_after : 100 - m.features.win_after }));
  const at = (n: number) => pts.filter((p) => p.move <= n).at(-1)?.w ?? null;
  const best = pts.reduce((a, b) => (b.w > a.w ? b : a));
  const worst = pts.reduce((a, b) => (b.w < a.w ? b : a));
  let changes = 0, state: string | null = null;
  for (const p of pts) {
    const s = p.w >= 60 ? "ahead" : p.w <= 40 ? "behind" : null;
    if (s && state && s !== state) changes++;
    if (s) state = s;
  }

  // Clock.
  const timed = mine.filter((m) => m.features.clock.spent_s !== null);
  const spent = timed.map((m) => m.features.clock.spent_s!);
  const thinkable = mine.filter((m) => m.label !== "book" && m.label !== "forced" && m.features.clock.spent_s !== null);
  const lowClock = (m: MF, s: number) => m.features.clock.left_s !== null && m.features.clock.left_s < s;
  const lastMine = mine.at(-1)?.features.clock.left_s ?? null;
  const lastTheirs = theirs.at(-1)?.features.clock.left_s ?? null;

  // Opening habits.
  const castle = mine.find((m) => m.features.san.startsWith("O-O"));
  const tenth = mine.filter((m) => m.features.move_number <= 10).at(-1);
  const leftBook = mine.find((m) => m.label !== "book");
  const fell = mine.find((m) => m.features.trap?.role === "fell");
  const sprang = mine.find((m) => m.features.trap?.role === "set");
  const endgame = mf.find((m) => m.phase === "endgame");
  const materials = mine.map((m) => m.features.material.after);
  const mate = mf.find((m) => m.features.mate_pattern);

  // Tags, Jev, Maia.
  const allTags = mine.flatMap((m) => m.tags ?? []);
  const tagCounts = count(allTags);
  const maia = new Map((mistakes ?? []).map((m) => [m.ply as number, m.maia as { p_played: number } | null]));
  const maiaPs = errs.map((m) => maia.get(m.ply)?.p_played).filter((x): x is number => typeof x === "number");
  const punished = theirs.filter((m) => m.label === "blunder" || m.label === "miss").filter((m) => {
    const reply = mine.find((x) => x.ply === m.ply + 1);
    return reply && ["best", "great", "brilliant", "excellent"].includes(reply.label ?? "");
  }).length;

  const tc = /^(\d+)(?:\+(\d+))?$/.exec(g.time_control ?? "");
  const end = new Date(g.end_time);
  const ending = describeEnding(g.result, g.result_detail);
  const s = review?.summary as { verdict?: string; headline?: string; conclusion?: string; work_on?: string; fell_short?: string[]; went_well?: string | string[] } | null;
  const errorMoves = errs.map((m) => m.features.move_number);
  const blunderMoves = mine.filter((m) => m.label === "blunder").map((m) => m.features.move_number);

  const row = {
    game_id: gameId,
    analyzed_at: new Date().toISOString(),
    pipeline_version: PIPELINE_VERSION,
    end_time: g.end_time,
    time_class: g.time_class,
    time_control: g.time_control,
    base_seconds: tc ? Number(tc[1]) : null,
    increment_seconds: tc ? Number(tc[2] ?? 0) : null,
    my_color: g.my_color,
    opponent: g.opponent,
    my_rating: g.my_rating,
    opponent_rating: g.opponent_rating,
    rating_diff: g.my_rating !== null && g.opponent_rating !== null ? g.my_rating - g.opponent_rating : null,
    result: g.result,
    ending: g.result_detail,
    ending_text: ending.long,
    ended_by: ending.by,
    eco: g.eco,
    opening_name: g.opening_name,
    opening_family: g.opening_name ? g.opening_name.split(/\s+/).slice(0, 2).join(" ") : null,
    move_count: g.move_count ?? Math.ceil(mf.length / 2),
    hour_of_day: end.getUTCHours(),
    day_of_week: end.getUTCDay(),
    accuracy: g.accuracy_ours,
    accuracy_opponent: accFor(theirs),
    accuracy_chesscom: g.accuracy_chesscom,
    accuracy_opening: accFor(mine.filter((m) => m.phase === "opening")),
    accuracy_middlegame: accFor(mine.filter((m) => m.phase === "middlegame")),
    accuracy_endgame: accFor(mine.filter((m) => m.phase === "endgame")),
    n_brilliant: labels.brilliant ?? 0,
    n_great: labels.great ?? 0,
    n_book: labels.book ?? 0,
    n_best: labels.best ?? 0,
    n_excellent: labels.excellent ?? 0,
    n_good: labels.good ?? 0,
    n_inaccuracy: labels.inaccuracy ?? 0,
    n_mistake: labels.mistake ?? 0,
    n_miss: labels.miss ?? 0,
    n_blunder: labels.blunder ?? 0,
    n_forced: labels.forced ?? 0,
    n_errors: errs.length,
    opp_n_inaccuracy: oppLabels.inaccuracy ?? 0,
    opp_n_mistake: oppLabels.mistake ?? 0,
    opp_n_miss: oppLabels.miss ?? 0,
    opp_n_blunder: oppLabels.blunder ?? 0,
    opp_blunders_punished: punished,
    errors_opening: byPhase("opening", ERR),
    errors_middlegame: byPhase("middlegame", ERR),
    errors_endgame: byPhase("endgame", ERR),
    blunders_opening: byPhase("opening", blunderSet),
    blunders_middlegame: byPhase("middlegame", blunderSet),
    blunders_endgame: byPhase("endgame", blunderSet),
    first_error_move: errorMoves[0] ?? null,
    first_blunder_move: blunderMoves[0] ?? null,
    biggest_drop: r1(biggest?.d),
    biggest_drop_move: biggest && biggest.d > 0 ? biggest.move : null,
    win_at_10: r1(at(10)),
    win_at_20: r1(at(20)),
    win_at_30: r1(at(30)),
    win_end: r1(pts.at(-1)!.w),
    best_win: r1(best.w),
    best_win_move: best.move,
    worst_win: r1(worst.w),
    worst_win_move: worst.move,
    pct_moves_ahead: Math.round((pts.filter((p) => p.w >= 60).length / pts.length) * 100),
    pct_moves_behind: Math.round((pts.filter((p) => p.w <= 40).length / pts.length) * 100),
    lead_changes: changes,
    threw_winning: best.w >= 75 && g.result !== "win",
    comeback: worst.w <= 25 && g.result !== "loss",
    my_time_left_end_s: lastMine === null ? null : Math.round(lastMine),
    opp_time_left_end_s: lastTheirs === null ? null : Math.round(lastTheirs),
    avg_move_time_s: spent.length ? r1(spent.reduce((a, b) => a + b, 0) / spent.length) : null,
    median_move_time_s: r1(median(spent)),
    moves_under_60s: mine.filter((m) => lowClock(m, 60)).length,
    moves_under_30s: mine.filter((m) => lowClock(m, 30)).length,
    errors_under_60s: errs.filter((m) => lowClock(m, 60)).length,
    instant_moves: thinkable.filter((m) => m.features.clock.spent_s! <= 2).length,
    instant_errors: errs.filter((m) => m.features.clock.spent_s !== null && m.features.clock.spent_s <= 2).length,
    long_thinks: mine.filter((m) => (m.tags ?? []).includes("long_think")).length,
    long_think_errors: mine.filter((m) => (m.tags ?? []).includes("long_think") && BIG.has(m.label ?? "")).length,
    castled: !!castle,
    castled_move: castle?.features.move_number ?? null,
    castle_side: castle ? (castle.features.san.startsWith("O-O-O") ? "queenside" : "kingside") : null,
    minors_developed_by_10: tenth?.features.development.mine_after ?? null,
    queen_moves_first_10: mine.filter((m) => m.features.move_number <= 10 && m.features.piece === "queen").length,
    left_book_move: leftBook?.features.move_number ?? null,
    fell_for_trap: fell?.features.trap?.name ?? null,
    sprang_trap: sprang?.features.trap?.name ?? null,
    max_material_lead: materials.length ? Math.max(0, ...materials) : null,
    max_material_deficit: materials.length ? Math.max(0, ...materials.map((x) => -x)) : null,
    reached_endgame: !!endgame,
    endgame_start_move: endgame?.features.move_number ?? null,
    mate_pattern: mate?.features.mate_pattern ? `${mate.is_mine ? "delivered" : "suffered"}_${mate.features.mate_pattern}` : null,
    tag_counts: tagCounts,
    bad_tags: Object.keys(tagCounts).filter((t) => TAG_BY_ID.get(t)?.polarity === "bad"),
    good_tags: Object.keys(tagCounts).filter((t) => TAG_BY_ID.get(t)?.polarity === "good"),
    principle_counts: count(errs.map((m) => m.jev?.principle?.value)),
    category_counts: count(errs.map((m) => m.jev?.category?.value)),
    root_cause_counts: count(errs.map((m) => m.jev?.root_cause?.value)),
    intent_counts: count(mine.map((m) => m.jev?.intent?.value)),
    maia_avg_played: maiaPs.length ? Math.round((maiaPs.reduce((a, b) => a + b, 0) / maiaPs.length) * 1000) / 1000 : null,
    common_mistakes: maiaPs.filter((p) => p >= 0.3).length,
    rare_mistakes: maiaPs.filter((p) => p <= 0.1).length,
    verdict: s?.verdict ?? null,
    headline: s?.headline ?? null,
    conclusion: s?.conclusion ?? s?.work_on ?? null,
    fell_short: s?.fell_short ?? null,
    went_well: s?.went_well ? (Array.isArray(s.went_well) ? s.went_well : [s.went_well]) : null,
    jev_cost: Math.round(mine.reduce((a, m) => a + (m.jev?.usage?.cost ?? 0), 0) * 1e6) / 1e6,
  };
  const { error } = await db.from(T.game_analysis).upsert(row, { onConflict: "game_id" });
  if (error) throw new Error(`save game analysis: ${error.message}`);
}
