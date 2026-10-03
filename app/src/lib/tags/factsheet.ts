import type { MoveFeatures } from "@/lib/analysis/features";
import { tagPlain } from "./catalog";

export type MaiaFact = { elo: number; p_played: number; p_best: number | null } | null;

const LABEL_WORDS: Record<string, string> = {
  brilliant: "a brilliant move",
  great: "a great move",
  book: "a standard opening (book) move",
  best: "the best move",
  excellent: "an excellent move",
  good: "a good move",
  inaccuracy: "an inaccuracy (a small mistake)",
  mistake: "a mistake",
  miss: "a miss (the opponent had just slipped and this move didn't take advantage)",
  blunder: "a blunder (a big mistake)",
  forced: "the only legal move",
};

const list = (xs: { piece: string; square: string }[]) => xs.map((x) => `${x.piece} on ${x.square}`).join(", ");
const secs = (s: number | null) => (s === null ? "unknown" : s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/**
 * The move as plain sentences: what Jev classifies and what Arthur's notes are
 * based on. Every sentence is a computed fact; nothing here is a guess.
 */
export function factSheet(f: MoveFeatures, maia: MaiaFact = null): string[] {
  const me = f.side === "white" ? "White" : "Black";
  const them = f.side === "white" ? "Black" : "White";
  const s: string[] = [];
  s.push(`Move ${f.move_number}: ${me} played ${f.san}, moving a ${f.piece}${f.played?.captures ? ` and capturing a ${f.played.captures}` : ""}${f.played?.check ? ", giving check" : ""}. Game phase: ${f.phase}.`);
  s.push(`The engine rates it ${LABEL_WORDS[f.label ?? ""] ?? "unrated"}.`);
  s.push(`${me}'s winning chances went from ${f.win_before}% to ${f.win_after}% (${f.state_before} before the move).`);
  s.push(`Material before the move: ${f.material.before > 0 ? `${me} up ${f.material.before}` : f.material.before < 0 ? `${me} down ${-f.material.before}` : "equal"} (pawn = 1, knight/bishop = 3, rook = 5, queen = 9).`);

  if (f.threats_before.length) s.push(`Before the move, the opponent was threatening to win: ${list(f.threats_before)}.`);
  else s.push("Before the move, none of the player's pieces were under threat.");
  if (f.free_for_mover.length) s.push(`Before the move, ${them} had left these pieces where they could be won: ${list(f.free_for_mover)}.`);
  s.push(`Available forcing moves before the move: ${f.forcing_available.checks} checks and ${f.forcing_available.captures} captures.`);

  if (f.played_best) s.push("This was the engine's top choice.");
  else if (f.best.san) {
    const b = f.best.pattern;
    const what = [
      b?.mate && "checkmate",
      b?.fork.length && `a fork of the ${b.fork.join(" and ")}`,
      b?.pin && "a pin",
      b?.skewer && "a skewer",
      b?.discovered && "a discovered attack",
      b?.captures && `capturing a ${b.captures}${b.captures_free ? " that was free" : ""}`,
      b?.check && "check",
      b?.traps_piece && `trapping the ${b.traps_piece}`,
      b?.promotes && "promotion",
    ].filter(Boolean);
    s.push(`The engine preferred ${f.best.san} (a ${f.best.piece} move${what.length ? `: ${what.join(", ")}` : ", a quiet move"}).${f.best.material_gain && f.best.material_gain > 0 ? ` Its line wins about ${f.best.material_gain} points of material.` : ""}`);
  }

  if (f.hanging_after.length) s.push(`After the move, these ${me} pieces could be won by ${them}: ${list(f.hanging_after)}.`);
  if (f.reply.san) {
    const r = f.reply.pattern;
    const what = [
      r?.mate && "checkmate",
      r?.captures && `capturing a ${r.captures}`,
      r?.fork.length && `forking the ${r.fork.join(" and ")}`,
      r?.pin && "pinning a piece",
      r?.skewer && "a skewer",
      r?.discovered && "a discovered attack",
      r?.check && "check",
      r?.traps_piece && `trapping the ${r.traps_piece}`,
      r?.promotes && "promoting",
    ].filter(Boolean);
    s.push(`${them}'s best answer is ${f.reply.san} (${f.reply.piece}${what.length ? `: ${what.join(", ")}` : ", quiet"}).`);
    if (f.reply.mate_threat) s.push(`After that answer, ${them} threatens checkmate in one.`);
    if (f.reply.material_after !== null && f.reply.material_after !== f.material.after) s.push(`After the best answer and a few more moves, material for ${me} would be ${f.reply.material_after}.`);
  }

  s.push(
    `King: ${f.king.castled_after ? "castled" : "not castled"}, ${f.king.shield_after} shield pawns (was ${f.king.shield_before}), ${f.king.zone_attackers_after} enemy pieces aiming next to it.${f.king.castling_rights_lost ? " This move gave up the right to castle." : ""}`,
  );
  if (f.phase === "opening") s.push(`Development: ${me} has ${f.development.mine_after} of 4 knights and bishops out; ${them} has ${f.development.theirs}.`);
  const st = f.structure;
  if (st.after.doubled !== st.before.doubled || st.after.isolated !== st.before.isolated || st.after.passed !== st.before.passed)
    s.push(`Pawns: doubled ${st.before.doubled}→${st.after.doubled}, isolated ${st.before.isolated}→${st.after.isolated}, passed ${st.before.passed}→${st.after.passed}.`);
  if (f.clock.left_s !== null)
    s.push(`Clock: ${secs(f.clock.left_s)} left after the move, spent ${secs(f.clock.spent_s)} on it (a typical move took ${secs(f.clock.typical_spent_s)}); opponent had ${secs(f.clock.opp_left_s)}.`);
  if (maia)
    s.push(`About ${Math.round(maia.p_played * 100)}% of players rated ${maia.elo} play this move${maia.p_best !== null ? `; ${Math.round(maia.p_best * 100)}% find the engine's move` : ""}.`);
  if (f.rules.length) s.push(`Patterns already confirmed by board analysis: ${f.rules.map(tagPlain).join(" ")}`);
  return s;
}
