/**
 * Evaluation math shared by the browser engine pass, the server and Practice mode.
 * Formulas follow Lichess (lila: WinPercent, AccuracyPercent, Advice).
 */

/** An engine score from WHITE's perspective. `mate` > 0 means White mates in N. */
export type Score = { cp: number; mate?: undefined } | { mate: number; cp?: undefined };

export type Classification = "best" | "good" | "inaccuracy" | "mistake" | "blunder";
export type Severity = Exclude<Classification, "best" | "good">;

/** Drops on the "winning chances" scale (−1…+1); 0.1 = 5 win-percentage points. */
export const THRESHOLDS = { inaccuracy: 0.1, mistake: 0.2, blunder: 0.3 } as const;
export type Thresholds = { inaccuracy: number; mistake: number; blunder: number };

export const CP_CLAMP = 1000;
export const MATE_CP = 1000;

/** Centipawns from White's view, with mate treated as ±1000 and everything clamped to ±1000. */
export function scoreToCp(score: Score): number {
  if (score.mate !== undefined) return score.mate > 0 ? MATE_CP : -MATE_CP;
  return Math.max(-CP_CLAMP, Math.min(CP_CLAMP, score.cp));
}

/** Lichess win%: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1), for the side the cp favours. */
export function winPct(cp: number): number {
  const c = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** White's win% (0–100) for a score. */
export function whiteWinPct(score: Score): number {
  return winPct(scoreToCp(score));
}

/** Win% from one side's perspective. */
export function sideWinPct(score: Score, side: "w" | "b"): number {
  const w = whiteWinPct(score);
  return side === "w" ? w : 100 - w;
}

/** Lichess per-move accuracy from the mover's win% before and after, clamped 0–100. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Mean of per-move accuracies (null if no moves). */
export function gameAccuracy(accs: number[]): number | null {
  if (!accs.length) return null;
  return accs.reduce((a, b) => a + b, 0) / accs.length;
}

export type MoveJudgement = {
  winBefore: number; // mover's win% before the move
  winAfter: number; // mover's win% after the move
  drop: number; // on the winning-chances scale
  accuracy: number;
  classification: Classification;
  missedMate: boolean;
};

/**
 * Judges one move from the mover's perspective.
 * `before` is the score of the position the move was played from (best play),
 * `after` the score of the resulting position. A missed forced mate counts as a blunder.
 */
export function judgeMove(args: {
  before: Score;
  after: Score;
  mover: "w" | "b";
  playedBest: boolean;
  deliversMate: boolean;
  thresholds?: Thresholds;
}): MoveJudgement {
  const t = args.thresholds ?? THRESHOLDS;
  const winBefore = sideWinPct(args.before, args.mover);
  const winAfter = args.deliversMate ? 100 : sideWinPct(args.after, args.mover);
  const drop = Math.max(0, (winBefore - winAfter) / 50);

  const moverMateBefore = mateFor(args.before, args.mover);
  const moverMateAfter = mateFor(args.after, args.mover);
  const missedMate = !args.deliversMate && moverMateBefore !== null && moverMateBefore > 0 && (moverMateAfter === null || moverMateAfter <= 0);

  let classification: Classification;
  if (missedMate || drop >= t.blunder) classification = "blunder";
  else if (drop >= t.mistake) classification = "mistake";
  else if (drop >= t.inaccuracy) classification = "inaccuracy";
  else classification = args.playedBest ? "best" : "good";

  return { winBefore, winAfter, drop, accuracy: moveAccuracy(winBefore, winAfter), classification, missedMate };
}

/** Mate-in-N from `side`'s perspective (positive = side mates), or null if no mate score. */
export function mateFor(score: Score, side: "w" | "b"): number | null {
  if (score.mate === undefined) return null;
  return side === "w" ? score.mate : -score.mate;
}

export function isSeverity(c: string | null | undefined): c is Severity {
  return c === "blunder" || c === "mistake" || c === "inaccuracy";
}

/** "+1.2", "−0.4", "#3", "#−2" from White's perspective. */
export function formatScore(score: Score | null | undefined): string | null {
  if (!score) return null;
  if (score.mate !== undefined) return score.mate > 0 ? `#${score.mate}` : `#−${Math.abs(score.mate)}`;
  const v = Math.round(score.cp / 10) / 10; // round first so -0.02 shows as 0.0, not −0.0
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
}
