import { Chess, type Square } from "chess.js";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Facts about one move needed for its label: how many legal moves there were
 * (1 = Forced) and whether it offers material (a candidate Brilliant): a piece
 * left where the opponent can take it for a net gain of at least two pawns.
 */
export function moveContext(fenBefore: string, uci: string): { legalMoves: number; sacrifice: boolean } {
  const c = new Chess(fenBefore);
  const legalMoves = c.moves().length;
  let sacrifice = false;
  try {
    const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    const value = VALUE[mv.piece] ?? 0;
    if (value >= 3 && !mv.promotion) {
      const to = mv.to as Square;
      const them = c.turn();
      const us = them === "w" ? "b" : "w";
      // Only captures the opponent can actually play (respects pins and check).
      const takers = c.moves({ verbose: true }).filter((m) => m.to === to && m.captured);
      if (takers.length) {
        const cheapest = Math.min(...takers.map((m) => VALUE[m.piece] ?? 0));
        const defended = c.attackers(to, us).length > 0;
        const captured = mv.captured ? (VALUE[mv.captured] ?? 0) : 0;
        const net = value - captured - (defended ? cheapest : 0);
        sacrifice = net >= 2;
      }
    }
  } catch {
    // illegal move string: no context
  }
  return { legalMoves, sacrifice };
}
