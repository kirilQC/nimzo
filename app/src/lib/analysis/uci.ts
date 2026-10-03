import type { Score } from "./math";

/** One principal variation from a UCI `info` line, with the score from the SIDE TO MOVE's view. */
export type UciLine = { multipv: number; depth: number; score: Score; pv: string[] };

/**
 * Parses `info depth 16 seldepth 22 multipv 1 score cp 34 nodes ... pv e2e4 e7e5 ...`.
 * Returns null for info lines without a score or pv (currmove, string, bound-only lines).
 */
export function parseInfo(line: string): UciLine | null {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;
  if (/ (lowerbound|upperbound)( |$)/.test(line)) return null;
  const tokens = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  let pv: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "depth") depth = Number(tokens[++i]);
    else if (t === "multipv") multipv = Number(tokens[++i]);
    else if (t === "score") {
      const kind = tokens[++i];
      const v = Number(tokens[++i]);
      score = kind === "mate" ? { mate: v } : { cp: v };
    } else if (t === "pv") {
      pv = tokens.slice(i + 1);
      break;
    }
  }
  if (!score || !pv.length || !Number.isFinite(depth)) return null;
  return { multipv, depth, score, pv };
}

/** Flips a side-to-move score to White's perspective. */
export function toWhitePerspective(score: Score, sideToMove: "w" | "b"): Score {
  if (sideToMove === "w") return score;
  return score.mate !== undefined ? { mate: -score.mate } : { cp: -score.cp! };
}

export function parseBestMove(line: string): string | null {
  const m = /^bestmove (\S+)/.exec(line);
  return m && m[1] !== "(none)" ? m[1]! : null;
}
