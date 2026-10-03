/**
 * Evaluation math shared by the browser engine pass, the server and Practice mode.
 * The win% curve is Lichess's; the label thresholds and the accuracy formula are
 * fitted to chess.com Game Review on 35 of the player's games (calibration/fit2.mjs,
 * checked on held-out games), so Nimzo's numbers read like chess.com's.
 */

/** An engine score from WHITE's perspective. `mate` > 0 means White mates in N. */
export type Score = { cp: number; mate?: undefined } | { mate: number; cp?: undefined };

/** chess.com's ten move labels, plus "forced" (the only legal move; shown without a badge). */
export type Classification =
  | "brilliant" | "great" | "book" | "best" | "excellent" | "good"
  | "inaccuracy" | "mistake" | "miss" | "blunder" | "forced";
export type Severity = "inaccuracy" | "mistake" | "miss" | "blunder";

/**
 * Drops on the "winning chances" scale (−1…+1); 0.1 = 5 win-percentage points.
 * Fitted to chess.com (Lichess uses 0.1 / 0.2 / 0.3, which flags far more moves).
 */
export const THRESHOLDS = { inaccuracy: 0.16, mistake: 0.28, blunder: 0.6 } as const;

/**
 * The other labels, in win-% points (0–100) from the mover's side, fitted to
 * chess.com on 35 games (calibration/fit3.mjs). A "gift" is how much the
 * opponent's previous move handed you.
 */
export const LABEL_FIT = {
  excellent: 2.5, // max loss for Excellent (more is Good)
  missGift: 10, // Miss: opponent gave at least this much…
  missDrop: 15, // …you gave at least this much back…
  missTol: 20, // …and you ended up no more than this far below where you were before their gift
  greatGift: 20, // Great: the engine's move right after a gift this big
  brilliantMaxLoss: 2.5, // Brilliant: a sound piece sacrifice…
  brilliantMaxWinBefore: 90, // …when you weren't already completely winning
} as const;
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

/**
 * Accuracy uses a flatter win curve and a steeper per-move penalty than Lichess,
 * then a power mean that lets a few bad moves pull the game score down — the
 * combination that matched chess.com's game accuracy best (about 5 points off on
 * held-out games, versus 17 for a plain Lichess mean).
 */
export const ACCURACY_FIT = { k: 0.0015, b: 0.15, q: 0.25 } as const;

/** Win% on the accuracy curve, from one side's perspective. */
export function accuracyWinPct(score: Score, side: "w" | "b"): number {
  const w = 50 + 50 * (2 / (1 + Math.exp(-ACCURACY_FIT.k * scoreToCp(score))) - 1);
  return side === "w" ? w : 100 - w;
}

/** Per-move accuracy (0–100) from the mover's accuracy-curve win% before and after. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const acc = 103.1668 * Math.exp(-ACCURACY_FIT.b * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

/** Power mean of per-move accuracies (null if no moves). */
export function gameAccuracy(accs: number[]): number | null {
  if (!accs.length) return null;
  const q = ACCURACY_FIT.q;
  const m = accs.reduce((sum, a) => sum + Math.pow(Math.max(a, 1), q), 0) / accs.length;
  return Math.pow(m, 1 / q);
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
 * `after` the score of the resulting position, `beforeOpponent` the score before
 * the opponent's previous move (to spot gifts). A missed forced mate while still
 * winning is a Miss; otherwise it's judged by how much was lost.
 */
export function judgeMove(args: {
  before: Score;
  after: Score;
  mover: "w" | "b";
  playedBest: boolean;
  deliversMate: boolean;
  beforeOpponent?: Score | null;
  inBook?: boolean;
  legalMoves?: number;
  sacrifice?: boolean;
  thresholds?: Thresholds;
}): MoveJudgement {
  const t = args.thresholds ?? THRESHOLDS;
  const winBefore = sideWinPct(args.before, args.mover);
  const winAfter = args.deliversMate ? 100 : sideWinPct(args.after, args.mover);
  const drop = Math.max(0, (winBefore - winAfter) / 50);
  const accuracy = moveAccuracy(
    accuracyWinPct(args.before, args.mover),
    args.deliversMate ? 100 : accuracyWinPct(args.after, args.mover),
  );

  const moverMateBefore = mateFor(args.before, args.mover);
  const moverMateAfter = mateFor(args.after, args.mover);
  const missedMate = !args.deliversMate && moverMateBefore !== null && moverMateBefore > 0 && (moverMateAfter === null || moverMateAfter <= 0);

  const lost = winBefore - winAfter; // win-% points
  const winPrev = args.beforeOpponent ? sideWinPct(args.beforeOpponent, args.mover) : winBefore;
  const gift = winBefore - winPrev;
  const f = LABEL_FIT;

  let classification: Classification;
  if (args.inBook) classification = "book";
  else if (args.legalMoves === 1) classification = "forced";
  else if (gift >= f.missGift && lost >= f.missDrop && winAfter >= winPrev - f.missTol) classification = "miss";
  else if (missedMate && winAfter >= 50 && drop < t.blunder) classification = "miss";
  else if (missedMate || drop >= t.blunder) classification = "blunder";
  else if (drop >= t.mistake) classification = "mistake";
  else if (drop >= t.inaccuracy) classification = "inaccuracy";
  else if (args.sacrifice && lost <= f.brilliantMaxLoss && winBefore <= f.brilliantMaxWinBefore && winAfter >= 50) classification = "brilliant";
  else if (args.playedBest && gift >= f.greatGift) classification = "great";
  else if (args.playedBest || lost <= 0) classification = "best";
  else if (lost <= f.excellent) classification = "excellent";
  else classification = "good";

  return { winBefore, winAfter, drop, accuracy, classification, missedMate };
}

/** Mate-in-N from `side`'s perspective (positive = side mates), or null if no mate score. */
export function mateFor(score: Score, side: "w" | "b"): number | null {
  if (score.mate === undefined) return null;
  return side === "w" ? score.mate : -score.mate;
}

export function isSeverity(c: string | null | undefined): c is Severity {
  return c === "blunder" || c === "miss" || c === "mistake" || c === "inaccuracy";
}

/** "+1.2", "−0.4", "#3", "#−2" from White's perspective. */
export function formatScore(score: Score | null | undefined): string | null {
  if (!score) return null;
  if (score.mate !== undefined) return score.mate > 0 ? `#${score.mate}` : `#−${Math.abs(score.mate)}`;
  const v = Math.round(score.cp / 10) / 10; // round first so -0.02 shows as 0.0, not −0.0
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
}
