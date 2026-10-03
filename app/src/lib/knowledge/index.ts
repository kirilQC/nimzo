import data from "./sections.json";

/**
 * Nimzo's knowledge harness: the chess knowledge base (knowledge/nimzo-knowledge-base.md,
 * split by scripts/gen-knowledge.mjs) and the links that let Arthur and Jev use it.
 *
 * - Every move tag points at the sections that teach it (TAG_KNOWLEDGE).
 * - Every opening the player meets points at its encyclopedia entry (openingSections).
 * - The coaching rules and the player's rating-band guide are always in Arthur's
 *   system prompt (COACHING_CORE).
 * Arthur explains a mistake by naming the principle from these sections in plain words.
 */

export type Section = { id: string; title: string; level: number; parent: string | null; band: string | null; text: string };

export const SECTIONS: Section[] = (data as { sections: Section[] }).sections;
const BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export function section(id: string): Section | undefined {
  return BY_ID.get(id);
}

/** The sections that explain each tag, most relevant first. */
export const TAG_KNOWLEDGE: Record<string, string[]> = {
  // Hung material and missed threats (section 1.2 category a)
  hung_queen: ["3.5", "3.3", "2.7"],
  hung_rook: ["3.5", "3.3", "2.7"],
  hung_minor: ["3.5", "3.3", "2.7"],
  hung_pawn: ["3.3", "2.7"],
  hung_moved_piece: ["3.5", "3.3"],
  unprotected_other_piece: ["3.5", "3.3"],
  hanging_after_capture: ["3.6", "3.5", "4.9"],
  ignored_threat: ["2.7", "3.4", "3.3"],
  allowed_fork: ["4.1", "3.5"],
  allowed_knight_fork: ["4.1", "3.5"],
  allowed_pin: ["4.2"],
  allowed_skewer: ["4.3"],
  allowed_discovered_attack: ["4.4"],
  allowed_mate: ["5", "3.3"],
  allowed_mate_threat: ["4.18", "7.16", "3.3"],
  allowed_trapped_piece: ["4.14"],
  queen_trapped: ["4.14", "3.5", "6.1"],
  allowed_promotion: ["4.17", "7.6"],
  losing_capture: ["3.6", "3.5"],
  bad_exchange: ["2.2", "3.6"],
  moved_pinned_piece_line: ["4.2"],
  pinned_defender_illusion: ["3.5", "4.2"],
  stalemated_opponent: ["2.4", "2.8", "3.5"],
  back_rank_weakness: ["5.1", "3.5"],
  mated_back_rank: ["5.1", "3.5"],
  mated_smothered: ["5.2"],
  fell_for_trap: ["6.4", "5.13", "5.14"],
  rushed_after_gift: ["3.7"],
  // Missed own tactics (category b)
  missed_free_piece: ["2.7", "4", "3.3"],
  missed_free_pawn: ["3.3", "4"],
  missed_mate: ["5", "2.8"],
  missed_mate_in_one: ["5", "11.1"],
  missed_fork: ["4.1"],
  missed_pin: ["4.2"],
  missed_skewer: ["4.3"],
  missed_discovered_attack: ["4.4"],
  missed_winning_check: ["3.3", "9.2"],
  missed_trap: ["4.14"],
  missed_promotion: ["4.17", "8.1"],
  missed_punishment: ["3.7", "3.3"],
  missed_material_win: ["3.3", "4"],
  missed_queen_attack: ["4.1", "6.1"],
  missed_overloaded_defender: ["4.7", "4.5"],
  missed_removal_of_defender: ["4.11"],
  missed_deflection: ["4.5"],
  missed_zwischenzug: ["4.9"],
  missed_counterattack: ["7.16", "3.4"],
  // Tactics found
  found_fork: ["4.1"],
  found_pin: ["4.2"],
  found_skewer: ["4.3"],
  found_discovered_attack: ["4.4"],
  found_mate: ["5"],
  delivered_back_rank_mate: ["5.1"],
  delivered_smothered_mate: ["5.2"],
  won_free_piece: ["4", "2.7"],
  trapped_piece: ["4.14"],
  punished_mistake: ["3.3"],
  sound_sacrifice: ["4.19", "5.16"],
  promoted: ["2.3", "8.1"],
  set_trap: ["6.4"],
  // Opening (category e)
  early_queen: ["6.1", "5.14", "2.7"],
  same_piece_twice: ["6.1"],
  slow_development: ["6.1", "2.7"],
  not_castled: ["6.1", "2.7", "2.3"],
  lost_castling: ["2.3", "6.1"],
  f_pawn_weakening: ["5.14", "6.1"],
  edge_pawn_moves: ["6.1"],
  knight_on_rim: ["4.14", "6.1"],
  queen_pawn_grab: ["6.2", "6.1", "3.5"],
  castled_early: ["6.1"],
  developed_piece: ["6.1"],
  book_move: ["6.3"],
  ignored_center: ["6.1"],
  blocked_own_pieces: ["6.1", "7.9"],
  premature_attack_opening: ["6.1", "7.15"],
  // King safety
  weakened_king_shelter: ["7.16", "7.15"],
  king_under_fire: ["7.16", "7.15"],
  opened_lines_to_king: ["7.16"],
  king_walk: ["2.7", "6.1"],
  neglected_king_safety: ["6.1", "7.16"],
  // Structure and squares (category c)
  created_doubled_pawns: ["7.6"],
  created_isolated_pawn: ["7.1", "7.6"],
  gave_passed_pawn: ["7.6", "8.1"],
  created_passed_pawn: ["7.6", "8.1"],
  weak_squares: ["7.7"],
  overextended_pawns: ["7.7", "7.5"],
  // Trades
  traded_when_behind: ["7.17", "7.10"],
  traded_when_ahead: ["7.17", "8.1"],
  gave_up_bishop_pair: ["7.9"],
  even_trade: ["7.17"],
  queen_trade_when_behind: ["7.17"],
  unnecessary_trade: ["7.17", "7.9"],
  missed_simplification: ["7.17", "8.11"],
  good_simplification: ["7.17", "8.11"],
  // Clock and psychology (category f)
  time_scramble: ["10.2"],
  low_time: ["10.2"],
  rushed_critical_move: ["10.2", "3.7"],
  instant_blunder: ["3.7", "3.3"],
  long_think_blunder: ["9.1", "10.2"],
  long_think: ["10.2"],
  time_trouble_self_inflicted: ["10.2"],
  blunder_when_winning: ["3.7", "7.14"],
  mistake_when_equal: ["3.4"],
  collapse_when_losing: ["10.3", "10.4"],
  tilt_followup: ["10.3"],
  recapture_reflex: ["4.9", "3.5"],
  held_advantage: ["7.11"],
  forced_reply: ["2.4"],
  defended_threat: ["3.4"],
  // Judgment tags
  overloaded_own_defender: ["4.7"],
  removed_own_defender: ["3.5", "4.11"],
  allowed_deflection: ["4.5"],
  allowed_x_ray: ["4.10"],
  allowed_perpetual: ["4.16", "8.11"],
  miscounted_exchange: ["3.6", "3.5"],
  aimless_move: ["7.14", "7.13"],
  passive_retreat: ["7.13"],
  premature_attack: ["7.15", "7.11"],
  pawn_grab_greed: ["6.2", "6.1"],
  piece_misplaced: ["7.13", "7.7"],
  wrong_plan: ["7.14", "7.10"],
  bad_bishop: ["7.9"],
  rook_inactive: ["7.8"],
  gave_up_center: ["6.1", "7.15"],
  passive_king_endgame: ["8.1", "8.2"],
  ignored_passed_pawn: ["8.1", "7.6", "8.3"],
  wrong_pawn_push: ["8.2", "8.5"],
  failed_conversion: ["8.11", "8.1"],
  rook_behind_wrong: ["8.7.1", "7.8"],
  opposition_error: ["8.2", "8.4"],
  didnt_check_threats: ["2.7", "3.4", "3.3"],
  hope_chess: ["3.2"],
  one_move_thinking: ["3.2", "9.1"],
  tunnel_vision: ["3.4"],
  impulsive: ["3.7"],
  didnt_scan_forcing_moves: ["3.3", "9.2"],
  assumed_forced_recapture: ["4.9", "3.5"],
  relaxed_when_winning: ["3.7", "7.14"],
  panic_defense: ["7.16", "10.3"],
  trusted_opponent_threat: ["3.4"],
  copied_pattern_wrongly: ["6.3", "9.5"],
  good_prophylaxis: ["7.12"],
  improved_worst_piece: ["7.13"],
  good_defense: ["7.16"],
  active_king_endgame: ["8.1"],
  seized_open_file: ["7.8"],
  created_threat: ["3.3"],
};

/** Root causes and what Jev thinks the player was trying to do, for the same purpose. */
export const CAUSE_KNOWLEDGE: Record<string, string[]> = {
  missed_opponent_threat: ["2.7", "3.4"],
  didnt_see_reply: ["3.2", "3.3"],
  missed_own_tactic: ["3.3", "4"],
  miscalculated: ["9.2", "3.6"],
  time_pressure: ["10.2"],
  rushed_with_time: ["3.7", "10.2"],
  overthought: ["9.1"],
  greed: ["6.2", "3.7"],
  fear: ["3.4", "10.3"],
  relaxed_when_winning: ["3.7"],
  tilt: ["10.3"],
  unfamiliar_position: ["7.14", "6.3"],
  principle_ignored: ["6.1", "2.7"],
};

/** Opening name fragments (as chess.com names them) to encyclopedia sections. */
const OPENINGS: [RegExp, string[]][] = [
  [/italian|giuoco|two knights|evans|fried liver|traxler/i, ["6.5.1"]],
  [/ruy lopez|spanish|berlin/i, ["6.5.2"]],
  [/scotch/i, ["6.5.3"]],
  [/petrov|russian game|petroff|stafford/i, ["6.5.4"]],
  [/vienna/i, ["6.5.5"]],
  [/king'?s gambit/i, ["6.5.6"]],
  [/philidor|bishop'?s opening|center game|centre game|ponziani|four knights|king'?s pawn/i, ["6.5.7", "6.1"]],
  [/sicilian|alapin|smith.?morra|rossolimo|najdorf|dragon/i, ["6.6.1"]],
  [/french/i, ["6.6.2"]],
  [/caro.?kann/i, ["6.6.3"]],
  [/scandinavian|center counter|centre counter/i, ["6.6.4"]],
  [/pirc|modern defense|modern defence/i, ["6.6.5"]],
  [/alekhine/i, ["6.6.6"]],
  [/queen'?s gambit declined|qgd/i, ["6.7.1"]],
  [/queen'?s gambit accepted|qga/i, ["6.7.2"]],
  [/semi.?slav|meran/i, ["6.7.4"]],
  [/slav/i, ["6.7.3"]],
  [/london/i, ["6.7.5"]],
  [/king'?s indian defen/i, ["6.7.6"]],
  [/nimzo.?indian/i, ["6.7.7"]],
  [/gr[uü]nfeld/i, ["6.7.8"]],
  [/dutch/i, ["6.7.9"]],
  [/catalan|benoni|benko|budapest|trompowsky|colle|torre|queen'?s pawn|englund|zukertort/i, ["6.7.10", "6.1"]],
  [/english/i, ["6.8.1"]],
  [/r[eé]ti|king'?s indian attack/i, ["6.8.2"]],
  [/bird|larsen|van ?'?t ?kruijs|owen|nimzowitsch|amar|grob|polish|sokolsky/i, ["6.8.3", "6.1"]],
];

export function openingSections(name: string | null | undefined): string[] {
  if (!name) return ["6.1"];
  for (const [re, ids] of OPENINGS) if (re.test(name)) return ids;
  return ["6.1"];
}

/**
 * Kiril is rated about 450-500 on chess.com but plays like about 1000, so his
 * coaching pitch is the [100-600] and [600-1200] bands (knowledge base 1.2 rule 4).
 */
export const PLAYER_BANDS = ["11.1", "11.2"];

/** Always in Arthur's system prompt: how to coach, the safety routine, and his band guides. */
export const COACHING_CORE = ["1.2", "2.7", "3.2", "3.3", "3.7", ...PLAYER_BANDS];

export function sectionText(id: string, maxChars = 4000): string | null {
  const s = BY_ID.get(id);
  if (!s) return null;
  const t = s.text.length > maxChars ? `${s.text.slice(0, maxChars)}…` : s.text;
  return `[${s.id}] ${s.title}${s.band ? ` (${s.band})` : ""}\n${t}`;
}

/** The fixed knowledge block for Arthur's system prompt (stable, so it caches). */
export function coachingCore(): string {
  return COACHING_CORE.map((id) => sectionText(id, 6000)).filter(Boolean).join("\n\n");
}

/**
 * The sections relevant to a set of tags (and an opening), ranked by how often
 * they come up, trimmed to a character budget. Each returned block starts with
 * its section id, so answers can point at it.
 */
export function knowledgeFor(args: { tags?: string[]; causes?: string[]; opening?: string | null; budget?: number; exclude?: string[] }): { ids: string[]; text: string } {
  const score = new Map<string, number>();
  const bump = (ids: string[] | undefined, w: number) => ids?.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + w / (i + 1)));
  for (const t of args.tags ?? []) bump(TAG_KNOWLEDGE[t], 1);
  for (const c of args.causes ?? []) bump(CAUSE_KNOWLEDGE[c], 1);
  if (args.opening !== undefined) bump(openingSections(args.opening), 1.5);
  const exclude = new Set(args.exclude ?? []);
  const ranked = [...score].filter(([id]) => !exclude.has(id) && BY_ID.has(id)).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const budget = args.budget ?? 9000;
  const ids: string[] = [];
  const parts: string[] = [];
  let used = 0;
  for (const id of ranked) {
    // Whole top-level sections (like "5" or "4") can be long; give them a shorter slice.
    const t = sectionText(id, BY_ID.get(id)!.level <= 2 ? 1500 : 3500)!;
    if (used + t.length > budget && ids.length) continue;
    ids.push(id);
    parts.push(t);
    used += t.length;
  }
  return { ids, text: parts.join("\n\n") };
}

/** Plain titles for linking ("Learn more: Pin") in the UI. */
export function sectionTitle(id: string): string | null {
  return BY_ID.get(id)?.title ?? null;
}

const STOP = new Set("the a an and or of to in on at for is it my i you your me what why how when was were be do does did with this that from as by can could should would about if then than so not no".split(" "));
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const INDEX = SECTIONS.filter((s) => s.text.length > 80).map((s) => {
  const title = new Set(words(s.title));
  const body = words(s.text);
  const tf = new Map<string, number>();
  for (const w of body) tf.set(w, (tf.get(w) ?? 0) + 1);
  return { id: s.id, title, tf, len: body.length };
});
const DF = new Map<string, number>();
for (const d of INDEX) for (const w of d.tf.keys()) DF.set(w, (DF.get(w) ?? 0) + 1);

/** Keyword search over the knowledge base (BM25-style), for free-form questions. */
export function searchKnowledge(query: string, k = 3): string[] {
  const q = [...new Set(words(query))];
  if (!q.length) return [];
  const N = INDEX.length, avg = INDEX.reduce((s, d) => s + d.len, 0) / N;
  return INDEX.map((d) => {
    let score = 0;
    for (const w of q) {
      const tf = d.tf.get(w) ?? 0;
      const idf = Math.log(1 + (N - (DF.get(w) ?? 0) + 0.5) / ((DF.get(w) ?? 0) + 0.5));
      score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.len / avg)))) + (d.title.has(w) ? 2 * idf : 0);
    }
    return { id: d.id, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.id);
}
