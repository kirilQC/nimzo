import { Chess, type Color, type Square } from "chess.js";
import { pgnToPositions } from "../chess/pgn";
import { mateFor, sideWinPct, isSeverity, type Score } from "./math";
import { lineHasBackRankMate } from "./detectors";
import {
  NAME,
  developedMinors,
  enPrise,
  forcingMoves,
  isCastled,
  kingShield,
  kingZoneAttackers,
  materialBalance,
  movePattern,
  nonPawnMaterial,
  other,
  pawnStructure,
  pinsAgainst,
  type MovePattern,
} from "./board";

/**
 * Per-move features: everything code can know for certain about a move, for
 * both sides, computed from the PGN and the stored engine evaluations. These
 * feed the rule tags, Jev's fact sheet, Arthur's per-move notes, and the
 * player profile. No language model is involved here.
 */

export type EnginePosition = {
  ply: number;
  eval_cp: number | null;
  eval_mate: number | null;
  classification: string | null;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv_san: string[] | null;
};

export type MoveFeatures = {
  ply: number;
  move_number: number;
  side: "white" | "black";
  mine: boolean;
  san: string;
  uci: string;
  piece: string;
  label: string | null;
  phase: "opening" | "middlegame" | "endgame";
  win_before: number; // mover's win% before (best play)
  win_after: number;
  win_lost: number;
  state_before: "winning" | "better" | "equal" | "worse" | "losing";
  played_best: boolean;
  played: MovePattern | null;
  best: { san: string | null; piece: string | null; pattern: MovePattern | null; material_gain: number | null };
  reply: { san: string | null; piece: string | null; pattern: MovePattern | null; captures_square: string | null; material_after: number | null; mate_threat: boolean; back_rank_mate: boolean };
  bishops_before: number; // the mover's bishops before the move (for the bishop pair)
  material: { before: number; after: number };
  threats_before: { piece: string; square: string }[]; // mover's pieces the opponent could win before the move
  hanging_after: { piece: string; square: string }[]; // ... and after it
  free_for_mover: { piece: string; square: string }[]; // opponent pieces the mover could win
  pinned_after: number; // mover's pieces pinned after the move
  king: { castled_before: boolean; castled_after: boolean; shield_before: number; shield_after: number; zone_attackers_after: number; castling_rights_lost: boolean };
  development: { mine_after: number; theirs: number };
  structure: { before: ReturnType<typeof pawnStructure>; after: ReturnType<typeof pawnStructure>; opp_passed_before: number; opp_passed_after: number };
  forcing_available: { checks: number; captures: number };
  clock: { left_s: number | null; spent_s: number | null; opp_left_s: number | null; typical_spent_s: number | null };
  mate_for_mover_before: number | null;
  mate_for_mover_after: number | null;
  delivers_mate: boolean;
  stalemate: boolean;
  rules: string[]; // rule tag ids that fired
};

function scoreOf(p: EnginePosition | undefined): Score | null {
  if (!p) return null;
  if (p.eval_mate !== null) return { mate: p.eval_mate };
  if (p.eval_cp !== null) return { cp: p.eval_cp };
  return null;
}

function stateOf(w: number): MoveFeatures["state_before"] {
  return w >= 75 ? "winning" : w >= 58 ? "better" : w > 42 ? "equal" : w > 25 ? "worse" : "losing";
}

function phaseOf(c: Chess, moveNumber: number): MoveFeatures["phase"] {
  const np = nonPawnMaterial(c);
  const queens = c.board().flat().filter((p) => p?.type === "q").length;
  if (np <= 26 || (queens === 0 && np <= 32)) return "endgame";
  return moveNumber <= 10 ? "opening" : "middlegame";
}

/** Plays up to `n` SAN moves from `fen`; returns the resulting position (stops at the first illegal move). */
function playLine(fen: string, line: string[] | null, n: number): Chess {
  const c = new Chess(fen);
  for (const san of (line ?? []).slice(0, n)) {
    try {
      c.move(san);
    } catch {
      break;
    }
  }
  return c;
}

/** Could `side` mate in one if it were their move? (a "mate threat") */
function mateInOneThreat(fen: string, side: Color): boolean {
  const parts = fen.split(" ");
  if (parts[1] === side) return false;
  parts[1] = side;
  parts[3] = "-";
  let c: Chess;
  try {
    c = new Chess(parts.join(" "));
  } catch {
    return false;
  }
  if (c.inCheck()) return false;
  for (const m of c.moves()) {
    if (m.endsWith("#")) return true;
  }
  return false;
}

const castleRights = (fen: string, color: Color) => {
  const f = fen.split(" ")[2] ?? "-";
  return color === "w" ? /[KQ]/.test(f) : /[kq]/.test(f);
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export function buildFeatures(args: { pgn: string; myColor: "white" | "black"; positions: EnginePosition[] }): MoveFeatures[] {
  const game = pgnToPositions(args.pgn);
  const byPly = new Map(args.positions.map((p) => [p.ply, p]));
  const mineColor: Color = args.myColor === "white" ? "w" : "b";
  const typical = {
    w: median(game.plies.filter((p) => p.color === "w" && p.timeSpentMs != null).map((p) => p.timeSpentMs! / 1000)),
    b: median(game.plies.filter((p) => p.color === "b" && p.timeSpentMs != null).map((p) => p.timeSpentMs! / 1000)),
  };
  const out: MoveFeatures[] = [];
  const fired = { w: new Set<string>(), b: new Set<string>() }; // once-per-game rules
  const arrivedAt = { w: new Map<string, number>(), b: new Map<string, number>() }; // square -> ply a piece moved there
  const lastClock: Record<Color, number | null> = { w: null, b: null };

  for (const p of game.plies) {
    const mover = p.color;
    const opp = other(mover);
    const row = byPly.get(p.ply);
    const before = scoreOf(byPly.get(p.ply - 1));
    const after = scoreOf(row);
    const cb = new Chess(p.fenBefore);
    const ca = new Chess(p.fenAfter);
    const moveNumber = Math.ceil(p.ply / 2);
    const label = row?.classification ?? null;
    const sev = isSeverity(label);

    const wb = before ? sideWinPct(before, mover) : 50;
    const deliversMate = ca.isCheckmate();
    const wa = deliversMate ? 100 : after ? sideWinPct(after, mover) : wb;

    const played = movePattern(p.fenBefore, p.uci);
    const bestUci = row?.best_move_uci ?? null;
    const bestPattern = bestUci ? movePattern(p.fenBefore, bestUci) : null;
    const bestPiece = bestUci ? (cb.get(bestUci.slice(0, 2) as Square)?.type ?? null) : null;
    const playedBest = !!bestUci && bestUci === p.uci;

    const next = byPly.get(p.ply + 1); // its best move is the opponent's best reply
    const replyUci = next?.best_move_uci ?? null;
    const replyPattern = replyUci ? movePattern(p.fenAfter, replyUci) : null;
    const replyPiece = replyUci ? (ca.get(replyUci.slice(0, 2) as Square)?.type ?? null) : null;
    const replyTo = replyUci ? replyUci.slice(2, 4) : null;

    const matBefore = materialBalance(cb, mover);
    const matAfter = materialBalance(ca, mover);
    const afterReplyLine = next?.pv_san?.length ? materialBalance(playLine(p.fenAfter, next.pv_san, 4), mover) : null;
    const bestLineMat = row?.pv_san?.length ? materialBalance(playLine(p.fenBefore, row.pv_san, 5), mover) : null;

    const threatsBefore = enPrise(cb, mover, 1).map((x) => ({ piece: NAME[x.type], square: x.sq }));
    const hangingAfter = enPrise(ca, mover, 1).map((x) => ({ piece: NAME[x.type], square: x.sq }));
    const freeForMover = enPrise(cb, opp, 1).map((x) => ({ piece: NAME[x.type], square: x.sq }));

    const afterReply = replyUci ? playLine(p.fenAfter, next?.best_move_san ? [next.best_move_san] : null, 1) : null;
    const mateThreat = afterReply ? mateInOneThreat(afterReply.fen(), opp) : false;

    const clockLeft = p.clockMs != null ? p.clockMs / 1000 : null;
    lastClock[mover] = clockLeft;

    const f: MoveFeatures = {
      ply: p.ply,
      move_number: moveNumber,
      side: mover === "w" ? "white" : "black",
      mine: mover === mineColor,
      san: p.san,
      uci: p.uci,
      piece: NAME[cb.get(p.from as Square)?.type ?? "p"],
      label,
      phase: phaseOf(cb, moveNumber),
      win_before: Math.round(wb * 10) / 10,
      win_after: Math.round(wa * 10) / 10,
      win_lost: Math.round(Math.max(0, wb - wa) * 10) / 10,
      state_before: stateOf(wb),
      played_best: playedBest,
      played,
      best: { san: row?.best_move_san ?? null, piece: bestPiece ? NAME[bestPiece] : null, pattern: bestPattern, material_gain: bestLineMat === null ? null : bestLineMat - matBefore },
      reply: {
        san: next?.best_move_san ?? null,
        piece: replyPiece ? NAME[replyPiece] : null,
        pattern: replyPattern,
        captures_square: replyPattern?.captures ? replyTo : null,
        material_after: afterReplyLine,
        mate_threat: mateThreat,
        back_rank_mate: next?.pv_san?.length ? lineHasBackRankMate(p.fenAfter, next.pv_san, mover) : false,
      },
      bishops_before: cb.board().flat().filter((q) => q?.type === "b" && q.color === mover).length,
      material: { before: matBefore, after: matAfter },
      threats_before: threatsBefore,
      hanging_after: hangingAfter,
      free_for_mover: freeForMover,
      pinned_after: pinsAgainst(ca, mover).length,
      king: {
        castled_before: isCastled(cb, mover),
        castled_after: isCastled(ca, mover),
        shield_before: kingShield(cb, mover),
        shield_after: kingShield(ca, mover),
        zone_attackers_after: kingZoneAttackers(ca, mover),
        castling_rights_lost: castleRights(p.fenBefore, mover) && !castleRights(p.fenAfter, mover) && !p.san.startsWith("O-O"),
      },
      development: { mine_after: developedMinors(ca, mover), theirs: developedMinors(ca, opp) },
      structure: {
        before: pawnStructure(cb, mover),
        after: pawnStructure(ca, mover),
        opp_passed_before: pawnStructure(cb, opp).passed,
        opp_passed_after: pawnStructure(ca, opp).passed,
      },
      forcing_available: forcingMoves(p.fenBefore),
      clock: { left_s: clockLeft, spent_s: p.timeSpentMs != null ? p.timeSpentMs / 1000 : null, opp_left_s: lastClock[opp], typical_spent_s: typical[mover] },
      mate_for_mover_before: before ? mateFor(before, mover) : null,
      mate_for_mover_after: after ? mateFor(after, mover) : null,
      delivers_mate: deliversMate,
      stalemate: ca.isStalemate(),
      rules: [],
    };

    f.rules = ruleTags(f, { sev, out, fired: fired[mover], arrivedAt: arrivedAt[mover], prev: game.plies[p.ply - 2] ?? null });
    arrivedAt[mover].set(p.to, p.ply);
    out.push(f);
  }
  return out;
}

type RuleCtx = {
  sev: boolean;
  out: MoveFeatures[]; // earlier moves (both sides)
  fired: Set<string>; // once-per-game rules already fired for this side
  arrivedAt: Map<string, number>;
  prev: { san: string; to: string; color: Color } | null; // opponent's previous move
};

/** The deterministic tags for one move. Keep each rule strict: a missed tag is better than a wrong one. */
export function ruleTags(f: MoveFeatures, ctx: RuleCtx): string[] {
  const t = new Set<string>();
  const add = (id: string, cond: boolean) => cond && t.add(id);
  const once = (id: string, cond: boolean) => {
    if (cond && !ctx.fired.has(id)) {
      ctx.fired.add(id);
      t.add(id);
    }
  };
  const label = f.label;
  const sev = ctx.sev;
  const bigSev = label === "mistake" || label === "blunder" || label === "miss";
  const good = !sev && label !== "book" && label !== "forced";
  const P = f.played, B = f.best.pattern, R = f.reply.pattern;
  const value = (name: string) => ({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 })[name] ?? 0;

  // What the opponent's best reply takes, and whether it was hanging.
  const replyTakes = f.reply.captures_square ? f.hanging_after.find((h) => h.square === f.reply.captures_square) : undefined;
  if (sev && replyTakes) {
    add("hung_queen", replyTakes.piece === "queen");
    add("hung_rook", replyTakes.piece === "rook");
    add("hung_minor", replyTakes.piece === "knight" || replyTakes.piece === "bishop");
    add("hung_pawn", replyTakes.piece === "pawn" && f.win_lost >= 8);
    const movedTo = f.uci.slice(2, 4);
    add("hung_moved_piece", replyTakes.square === movedTo && replyTakes.piece !== "pawn");
    const wasThreatened = f.threats_before.some((x) => x.square === replyTakes.square);
    add("unprotected_other_piece", replyTakes.square !== movedTo && !wasThreatened && replyTakes.piece !== "pawn");
    add("ignored_threat", wasThreatened && value(replyTakes.piece) >= 3 && !(P?.captures && value(P.captures) >= value(replyTakes.piece)));
    add("hanging_after_capture", replyTakes.piece !== "pawn" && (!!P?.captures || !!ctx.prev?.san.includes("x")));
  }
  if (sev && R) {
    add("allowed_fork", R.fork.length >= 2);
    add("allowed_knight_fork", R.fork.length >= 2 && f.reply.piece === "knight");
    add("allowed_pin", R.pin);
    add("allowed_skewer", R.skewer);
    add("allowed_discovered_attack", R.discovered);
    add("allowed_trapped_piece", !!R.traps_piece);
    add("allowed_promotion", R.promotes);
  }
  const oppMateAfter = f.win_after <= 1 && !f.delivers_mate;
  add("allowed_mate", sev && oppMateAfter);
  add("allowed_mate_threat", bigSev && !oppMateAfter && f.reply.mate_threat);
  if (sev && P?.captures && f.reply.material_after !== null) add("losing_capture", f.reply.material_after <= f.material.before - 2);
  if (sev && P?.captures) add("bad_exchange", value(f.piece) - value(P.captures) >= 2 && f.reply.captures_square === f.uci.slice(2, 4));
  add("stalemated_opponent", f.stalemate && f.win_before >= 70);
  add("back_rank_weakness", sev && f.reply.back_rank_mate);

  // Missed chances: the engine's move did something and the player chose otherwise.
  const missedCtx = sev && !f.played_best;
  if (missedCtx && B) {
    const free = f.free_for_mover.find((x) => B.captures && x.piece === B.captures);
    add("missed_free_piece", !!free && value(free.piece) >= 3 && !(P?.captures && value(P.captures) >= value(free.piece)));
    add("missed_free_pawn", !!free && free.piece === "pawn" && !P?.captures);
    add("missed_fork", B.fork.length >= 2);
    add("missed_pin", B.pin);
    add("missed_skewer", B.skewer);
    add("missed_discovered_attack", B.discovered);
    add("missed_winning_check", B.check && (f.best.material_gain ?? 0) >= 2);
    add("missed_trap", !!B.traps_piece);
    add("missed_promotion", B.promotes);
    add("missed_queen_attack", B.attacks_queen && !B.check && (f.best.material_gain ?? 0) >= 2);
    const playedGain = f.reply.material_after === null ? null : f.reply.material_after - f.material.before;
    add("missed_material_win", (f.best.material_gain ?? 0) >= 2 && (playedGain === null || (f.best.material_gain ?? 0) - playedGain >= 2));
  }
  const mateBefore = f.mate_for_mover_before;
  add("missed_mate", !!mateBefore && mateBefore > 0 && !f.delivers_mate && !((f.mate_for_mover_after ?? 0) > 0));
  add("missed_mate_in_one", mateBefore === 1 && !f.delivers_mate);
  add("missed_punishment", label === "miss");

  const from = f.uci.slice(0, 2), to = f.uci.slice(2, 4);

  // Tactics found.
  if (good && P) {
    add("found_fork", P.fork.length >= 2);
    add("found_pin", P.pin && f.played_best);
    add("found_skewer", P.skewer && f.played_best);
    add("found_discovered_attack", P.discovered && f.played_best);
    const recapture = !!ctx.prev && ctx.prev.san.includes("x") && ctx.prev.to === to;
    add("won_free_piece", !!P.captures && P.captures_free && value(P.captures) >= 3 && !recapture);
    add("trapped_piece", !!P.traps_piece);
    add("promoted", P.promotes);
  }
  add("found_mate", f.delivers_mate);
  add("punished_mistake", label === "great");
  add("sound_sacrifice", label === "brilliant");

  // Opening habits (counted whatever the label: they're habits, not blunders).
  const opening = f.move_number <= 12 && f.phase !== "endgame";
  add("early_queen", f.piece === "queen" && f.move_number <= 6 && f.development.mine_after < 2 && !(P?.captures && P.captures_free));
  add(
    "same_piece_twice",
    opening && f.move_number <= 10 && ["knight", "bishop", "queen"].includes(f.piece) && ctx.arrivedAt.has(from) && !P?.captures && !f.threats_before.some((x) => x.square === from),
  );
  once("slow_development", f.move_number >= 9 && f.move_number <= 14 && f.development.mine_after <= 1 && f.phase !== "endgame");
  once("not_castled", f.move_number >= 12 && f.move_number <= 16 && !f.king.castled_after && f.phase !== "endgame");
  once("lost_castling", f.king.castling_rights_lost && !f.king.castled_after && f.phase !== "endgame");
  add("f_pawn_weakening", f.piece === "pawn" && from[0] === "f" && f.move_number <= 12 && !P?.captures);
  add("edge_pawn_moves", f.piece === "pawn" && (from[0] === "a" || from[0] === "h") && f.move_number <= 8 && !P?.captures);
  add("knight_on_rim", f.piece === "knight" && (to[0] === "a" || to[0] === "h") && f.phase !== "endgame" && !P?.captures);
  add("queen_pawn_grab", f.piece === "queen" && P?.captures === "pawn" && f.move_number <= 12);
  add("castled_early", f.san.startsWith("O-O") && f.move_number <= 10);
  add("developed_piece", (f.piece === "knight" || f.piece === "bishop") && ["b1", "g1", "c1", "f1", "b8", "g8", "c8", "f8"].includes(from) && f.move_number <= 15);
  add("book_move", label === "book");

  // King safety.
  add("weakened_king_shelter", f.king.castled_before && f.piece === "pawn" && f.king.shield_after < f.king.shield_before && f.phase !== "endgame" && !P?.captures);
  add("king_under_fire", sev && f.king.zone_attackers_after >= 3 && f.phase !== "endgame");
  add("opened_lines_to_king", sev && f.king.shield_after < f.king.shield_before && f.king.zone_attackers_after >= 2 && f.phase !== "endgame");
  add("king_walk", f.piece === "king" && !f.san.startsWith("O-O") && f.phase !== "endgame" && f.threats_before.length === 0 && !f.san.includes("x"));

  // Pawn structure.
  add("created_doubled_pawns", f.structure.after.doubled > f.structure.before.doubled);
  add("created_isolated_pawn", f.structure.after.isolated > f.structure.before.isolated);
  add("created_passed_pawn", f.structure.after.passed > f.structure.before.passed && f.phase !== "opening");
  add("gave_passed_pawn", f.structure.opp_passed_after > f.structure.opp_passed_before && f.phase !== "opening");

  // Trades.
  const even = !!P?.captures && value(P.captures) === value(f.piece) && value(f.piece) >= 3;
  add("even_trade", even);
  add("traded_when_behind", even && f.material.before <= -2);
  add("traded_when_ahead", even && f.material.before >= 2);
  add("queen_trade_when_behind", f.piece === "queen" && P?.captures === "queen" && f.material.before <= -2);
  add("gave_up_bishop_pair", f.piece === "bishop" && P?.captures === "knight" && f.bishops_before === 2);

  // Clock.
  const c = f.clock;
  add("time_scramble", c.left_s !== null && c.left_s < 30);
  add("low_time", c.left_s !== null && c.left_s >= 30 && c.left_s < 60);
  add("rushed_critical_move", bigSev && c.spent_s !== null && c.spent_s <= 3 && (c.left_s ?? 0) >= 60);
  add("instant_blunder", label === "blunder" && c.spent_s !== null && c.spent_s <= 1);
  const long = c.spent_s !== null && c.typical_spent_s !== null && c.spent_s >= Math.max(20, 3 * c.typical_spent_s);
  add("long_think", long);
  add("long_think_blunder", long && (label === "blunder" || label === "mistake"));
  once("time_trouble_self_inflicted", c.left_s !== null && c.opp_left_s !== null && c.left_s < 120 && c.left_s < 0.4 * c.opp_left_s);

  // Context.
  add("blunder_when_winning", f.win_before >= 70 && bigSev);
  add("mistake_when_equal", f.win_before > 40 && f.win_before < 60 && (label === "mistake" || label === "blunder"));
  add("collapse_when_losing", f.win_before <= 30 && label === "blunder");
  const myEarlier = ctx.out.filter((m) => m.side === f.side).slice(-2);
  add("tilt_followup", bigSev && myEarlier.some((m) => m.label === "blunder" || m.label === "mistake" || m.label === "miss"));
  add("recapture_reflex", sev && !!ctx.prev && ctx.prev.san.includes("x") && ctx.prev.to === to && !!P?.captures);
  add("forced_reply", label === "forced");
  add("held_advantage", f.win_before >= 65 && (label === "best" || label === "excellent"));
  add("defended_threat", good && f.threats_before.some((x) => value(x.piece) >= 3) && !f.hanging_after.some((h) => value(h.piece) >= 3));

  return [...t];
}

export const _internal = { mateInOneThreat, playLine, phaseOf };
