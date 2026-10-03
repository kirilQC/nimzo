import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/**
 * Cheap, certain tactical detectors computed with chess.js attack maps.
 * These win over Jev when they disagree. Each one is deliberately strict:
 * false negatives are fine (Jev covers the fuzzy cases), false positives are not.
 */

export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (const f of "abcdefgh") for (const r of "12345678") out.push(`${f}${r}` as Square);
  return out;
})();

const other = (c: Color): Color => (c === "w" ? "b" : "w");

/** Material from `color`'s point of view (pawns = 1, minor = 3, rook = 5, queen = 9). */
export function materialBalance(fen: string, color: Color): number {
  const c = new Chess(fen);
  let s = 0;
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (!p || p.type === "k") continue;
    s += p.color === color ? VALUE[p.type] : -VALUE[p.type];
  }
  return s;
}

/**
 * Pieces of `color` (knight or better) that are attacked and either undefended
 * or attacked by something cheaper. Pseudo-legal attack maps, so pins are ignored.
 */
export function hangingPieces(fen: string, color: Color): Square[] {
  const c = new Chess(fen);
  const out: Square[] = [];
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (!p || p.color !== color || p.type === "k" || VALUE[p.type] < 3) continue;
    const attackers = c.attackers(sq, other(color));
    if (!attackers.length) continue;
    const defenders = c.attackers(sq, color);
    const cheapest = Math.min(...attackers.map((a) => VALUE[c.get(a)!.type]));
    if (!defenders.length || cheapest < VALUE[p.type]) out.push(sq);
  }
  return out;
}

/**
 * After a move lands on `square`, which enemy pieces does that piece attack
 * that are worth more than it (or are the king)? Two or more = a fork.
 */
export function forkTargets(fenAfter: string, square: Square): Square[] {
  const c = new Chess(fenAfter);
  const piece = c.get(square);
  if (!piece) return [];
  const targets: Square[] = [];
  for (const sq of SQUARES) {
    const t = c.get(sq);
    if (!t || t.color === piece.color) continue;
    if (!c.attackers(sq, piece.color).includes(square)) continue;
    if (t.type === "k" || VALUE[t.type] > VALUE[piece.type]) {
      // An undefended equal-or-lower piece also counts when it simply hangs to the fork.
      targets.push(sq);
    } else if (!c.attackers(sq, t.color).length && VALUE[t.type] >= 3) {
      targets.push(sq);
    }
  }
  return targets;
}

/** Plays a SAN move from a FEN, or returns null if illegal. */
function play(fen: string, san: string) {
  const c = new Chess(fen);
  try {
    const mv = c.move(san);
    return { chess: c, move: mv };
  } catch {
    return null;
  }
}

export function isForkMove(fen: string, san: string | null | undefined): boolean {
  if (!san) return false;
  const r = play(fen, san);
  if (!r) return false;
  return forkTargets(r.chess.fen(), r.move.to as Square).length >= 2;
}

/**
 * Does `line` (SAN, starting from `fen`) end in a back-rank mate against `victim`?
 * Back rank = the victim's king on its first rank, mated by a rook or queen on that rank.
 */
export function lineHasBackRankMate(fen: string, line: string[], victim: Color): boolean {
  const c = new Chess(fen);
  for (const san of line) {
    let mv;
    try {
      mv = c.move(san);
    } catch {
      return false;
    }
    if (c.isCheckmate() && c.turn() === victim) {
      const rank = victim === "w" ? "1" : "8";
      const kingSq = SQUARES.find((sq) => {
        const p = c.get(sq);
        return p?.type === "k" && p.color === victim;
      });
      return !!kingSq && kingSq[1] === rank && (mv.piece === "r" || mv.piece === "q") && mv.to[1] === rank;
    }
  }
  return false;
}

export function lineHasMate(fen: string, line: string[]): boolean {
  const c = new Chess(fen);
  for (const san of line) {
    try {
      c.move(san);
    } catch {
      return false;
    }
    if (c.isCheckmate()) return true;
  }
  return false;
}

/** Rough game phase from move number and non-pawn material. */
export function gamePhase(fen: string): "opening" | "middlegame" | "endgame" {
  const c = new Chess(fen);
  const fullmove = Number(fen.split(" ")[5] ?? 1);
  let nonPawn = 0;
  let queens = 0;
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (!p || p.type === "k" || p.type === "p") continue;
    nonPawn += VALUE[p.type];
    if (p.type === "q") queens++;
  }
  if (nonPawn <= 26 || (queens === 0 && nonPawn <= 32)) return "endgame";
  if (fullmove <= 10) return "opening";
  return "middlegame";
}
