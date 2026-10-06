import "server-only";
import { z } from "zod";
import { Chess, type Color, type Square } from "chess.js";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { pgnToPositions } from "@/lib/chess/pgn";
import { NAME, VALUE, attacksFrom, enPrise, materialBalance, movePattern, other, piecesOf } from "@/lib/analysis/board";
import type { MoveFeatures } from "@/lib/analysis/features";
import { structuredCall } from "./claude";
import { COACH_VOICE, WHY_BEST_TASK } from "./prompts";
import { notationIn } from "./guard";
import { longSentences, noDashes } from "./text";

export type WhyBest = { text: string; model: string };

const CACHE_KEY = "__why_best"; // stored next to the tag explanations on the move row
const CENTER = new Set(["d4", "e4", "d5", "e5"]);

function play(c: Chess, move: string) {
  return /^[a-h][1-8][a-h][1-8]/.test(move) ? c.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }) : c.move(move);
}

/** Mate in one for the side to move? */
function hasMateInOne(c: Chess): boolean {
  for (const m of c.moves({ verbose: true })) {
    const t = new Chess(c.fen());
    t.move(m);
    if (t.isCheckmate()) return true;
  }
  return false;
}

/** The same position with the other side to move (en passant cleared), to ask "what were they threatening?". */
function passTurn(fen: string): Chess | null {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    const c = new Chess(parts.join(" "));
    return c.inCheck() ? null : c;
  } catch {
    return null;
  }
}

/**
 * What the engine's best move concretely does, in plain words from the mover's side:
 * what it takes, attacks, saves or stops, and what the engine line wins a few moves later.
 * Everything here is computed from the board; Arthur only puts it into a sentence.
 */
export function bestMoveFacts(fen: string, bestUci: string, pvSan: string[] | null, mine: boolean): string[] {
  const facts: string[] = [];
  const before = new Chess(fen);
  const me: Color = before.turn(), them = other(me);
  const your = mine ? "your" : "their", their = mine ? "their" : "your";
  const piece = before.get(bestUci.slice(0, 2) as Square);
  if (!piece) return facts;
  const after = new Chess(fen);
  let mv;
  try {
    mv = play(after, bestUci);
  } catch {
    return facts;
  }
  const pat = movePattern(fen, bestUci);
  const pName = NAME[piece.type];
  if (mv.san.startsWith("O-O")) facts.push(`it castles, tucking ${your} king into safety and bringing a rook toward the middle`);
  else facts.push(`it moves ${your} ${pName}`);

  if (pat?.mate) facts.push("it is checkmate");
  if (pat?.captures) facts.push(`it takes ${their} ${pat.captures}${pat.captures_free ? " for free" : ""}`);
  if (pat?.fork.length) facts.push(`it attacks ${their} ${pat.fork.join(" and ")} at the same time (a fork)`);
  if (pat?.pin) facts.push(`it pins one of ${their} pieces, so it cannot move without losing something bigger behind it`);
  if (pat?.skewer) facts.push(`it skewers ${their} pieces: the front one must move and the one behind falls`);
  if (pat?.discovered) facts.push(`moving it uncovers an attack from another of ${your} pieces`);
  if (pat?.check && !pat.mate) facts.push(`it gives check, so ${their} king must deal with it first`);
  if (pat?.traps_piece) facts.push(`${their} ${pat.traps_piece} gets trapped with no safe square`);
  if (pat?.promotes) facts.push("it promotes a pawn");

  // Pieces of mine that were in danger and are safe after it.
  const dangerBefore = enPrise(before, me, 3);
  const dangerAfter = new Set(enPrise(after, me, 3).map((p) => p.sq));
  for (const p of dangerBefore) {
    const movedAway = p.sq === mv.from;
    if (movedAway ? !dangerAfter.has(mv.to as Square) : !dangerAfter.has(p.sq)) {
      facts.push(movedAway ? `it moves ${your} ${NAME[p.type]} out of danger` : `it protects ${your} ${NAME[p.type]}, which could have been taken`);
    }
  }

  // A mate threat that existed and is gone.
  const theirTurnBefore = passTurn(fen);
  if (theirTurnBefore && hasMateInOne(theirTurnBefore) && !hasMateInOne(after)) facts.push(`it stops ${their} threat of checkmate`);

  // New targets for the moved piece, and enemy pieces that become winnable.
  if (!pat?.fork.length && !pat?.mate) {
    const hitBefore = new Set(attacksFrom(before, mv.from as Square));
    const hits = attacksFrom(after, mv.to as Square)
      .map((sq) => ({ sq, p: after.get(sq) }))
      .filter((x) => x.p && x.p.color === them && x.p.type !== "k" && VALUE[x.p.type] >= 3 && !hitBefore.has(x.sq));
    if (hits.length) facts.push(`it now attacks ${their} ${hits.map((h) => NAME[h.p!.type]).join(" and ")}`);
  }
  const winnableBefore = new Set(enPrise(before, them, 3).map((p) => p.sq));
  const winnable = enPrise(after, them, 3).filter((p) => !winnableBefore.has(p.sq) && p.sq !== mv.to);
  if (winnable.length) facts.push(`after it, ${their} ${winnable.map((p) => NAME[p.type]).join(" and ")} can be won`);

  // Quiet but useful.
  if (!pat?.captures && !pat?.check) {
    const backRank = me === "w" ? "1" : "8";
    if ((piece.type === "n" || piece.type === "b") && mv.from[1] === backRank) facts.push(`it develops a ${pName} off the back row so it joins the game`);
    if ((piece.type === "p" || piece.type === "n") && CENTER.has(mv.to)) facts.push("it grabs space in the center of the board");
  }

  // The engine line: what this move sets up over the next few moves.
  if (pvSan?.length) {
    const line = new Chess(fen);
    const startMat = materialBalance(line, me);
    let setup: string | null = null;
    for (let i = 0; i < Math.min(pvSan.length, 6); i++) {
      const fenNow = line.fen();
      let m;
      try {
        m = line.move(pvSan[i]!);
      } catch {
        break;
      }
      if (i === 0 || i % 2 === 1 || setup) continue; // my follow ups only
      const p = movePattern(fenNow, m.san);
      const when = i === 2 ? "on the next move" : "a couple of moves later";
      if (p?.mate) setup = `it sets up checkmate ${when}`;
      else if (p?.fork.length) setup = `it sets up a fork of ${their} ${p.fork.join(" and ")} ${when}`;
      else if (p?.captures && VALUE[m.captured ?? "p"] >= 3) setup = `it sets up winning ${their} ${p.captures} ${when}`;
      else if (p?.promotes) setup = `it sets up promoting a pawn ${when}`;
    }
    if (setup) facts.push(setup);
    const gain = materialBalance(line, me) - startMat;
    if (gain >= 2) facts.push(`with best play it wins about ${gain} points of material over the next few moves`);
    if (piecesOf(line, them).length && line.isCheckmate()) facts.push("the engine line ends in checkmate");
  }
  return facts;
}

/** Arthur's one or two sentences on why the engine's move from this position is best. Cached on the move row. */
export async function whyBest(gameId: string, ply: number): Promise<WhyBest> {
  const db = await getDb();
  const [{ data: game }, { data: pos }, { data: row }] = await Promise.all([
    db.from(T.games).select("pgn, my_color").eq("id", gameId).maybeSingle(),
    db.from(T.positions).select("best_move_uci, best_move_san, pv_san").eq("game_id", gameId).eq("ply", ply).maybeSingle(),
    db.from(T.move_features).select("features, tag_explanations").eq("game_id", gameId).eq("ply", ply).maybeSingle(),
  ]);
  if (!game) throw new Error("game not found");
  const cached = (row?.tag_explanations as Record<string, unknown> | null)?.[CACHE_KEY] as WhyBest | undefined;
  if (cached?.text) return cached;
  if (!pos?.best_move_uci) throw new Error("The engine hasn't looked at this position yet.");

  const parsed = pgnToPositions(game.pgn);
  const p = parsed.plies[ply - 1];
  if (!p) throw new Error("move not found");
  const mine = (p.color === "w") === (game.my_color === "white");
  const facts = bestMoveFacts(p.fenBefore, pos.best_move_uci, (pos.pv_san as string[] | null) ?? null, mine);
  const f = row?.features as MoveFeatures | undefined;
  const input = {
    whose_move: mine ? "the player's (you)" : "the opponent's (they)",
    engine_best_move_does: facts,
    move_actually_played: p.uci === pos.best_move_uci ? "the same move (it was the best move)" : "a different move",
    ...(f && p.uci !== pos.best_move_uci ? { winning_chances_for_mover: `${Math.round(f.win_before)}% with the best move, ${Math.round(f.win_after)}% after the move played` } : {}),
  };
  const schema = z.object({ text: z.string() });
  let user = JSON.stringify(input);
  let text = "";
  let model = env().CLAUDE_MODEL_COACH;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_COACH, system: `${COACH_VOICE}\n\n${WHY_BEST_TASK}`, user, schema, effort: "low", maxTokens: 800 });
    text = noDashes(res.data.text.trim());
    model = res.model;
    const bad = [...notationIn(text).map((n) => `notation ${n}`), ...longSentences(text, 22).map(() => "a sentence is too long")];
    if (!bad.length) break;
    if (attempt === 0) user = `${JSON.stringify(input)}\n\nRewrite: ${bad.join("; ")}. No notation or square names, short sentences.`;
  }
  const result: WhyBest = { text, model };
  if (row) {
    const next = { ...((row.tag_explanations as Record<string, unknown> | null) ?? {}), [CACHE_KEY]: result };
    await db.from(T.move_features).update({ tag_explanations: next }).eq("game_id", gameId).eq("ply", ply);
  }
  return result;
}
