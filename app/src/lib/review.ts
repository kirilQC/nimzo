import "server-only";
import type { CoachInfo, ReviewData, ReviewPly } from "@/components/review/GameReview";
import { pgnToPositions } from "@/lib/chess/pgn";
import { formatLine } from "@/lib/chess/lines";
import { formatScore, isSeverity, mateFor, type Score } from "@/lib/analysis/math";

export type PositionRecord = {
  ply: number;
  eval_cp: number | null;
  eval_mate: number | null;
  win_pct: number | string | null;
  classification: string | null;
  best_move_san: string | null;
  pv_san: string[] | null;
  multipv: { score: Score; pv_san: string[] }[] | null;
  clock_ms: number | null;
};

function scoreOf(p: PositionRecord | undefined): Score | null {
  if (!p) return null;
  if (p.eval_mate !== null) return { mate: p.eval_mate };
  if (p.eval_cp !== null) return { cp: p.eval_cp };
  return null;
}

/** Builds the review board data from the PGN plus stored engine positions (if any). */
export function buildReviewData(args: {
  gameId: string | null;
  pgn: string;
  myColor: "white" | "black";
  status: string;
  error: string | null;
  positions: PositionRecord[];
}): ReviewData {
  const parsed = pgnToPositions(args.pgn);
  const mine = args.myColor === "white" ? "w" : "b";
  const byPly = new Map(args.positions.map((p) => [p.ply, p]));
  const analyzed = args.positions.length === parsed.plies.length + 1;

  const plies: ReviewPly[] = parsed.plies.map((p) => {
    const row = byPly.get(p.ply);
    return {
      ply: p.ply,
      san: p.san,
      from: p.from,
      to: p.to,
      color: p.color,
      fenAfter: p.fenAfter,
      clockMs: p.clockMs,
      isMine: p.color === mine,
      severity: isSeverity(row?.classification) ? row.classification : null,
      whitePct: row?.win_pct !== null && row?.win_pct !== undefined ? Number(row.win_pct) : null,
    };
  });

  const coach: Record<number, CoachInfo> = {};
  if (analyzed) {
    for (const p of plies) {
      if (!p.isMine || !p.severity) continue;
      const row = byPly.get(p.ply)!;
      const before = scoreOf(byPly.get(p.ply - 1));
      const after = scoreOf(row);
      const next = byPly.get(p.ply + 1); // its best move = opponent's best reply to my move
      const top = row.multipv?.[0];
      const bestLine = row.multipv?.[0]?.pv_san ?? row.pv_san;
      const mateBefore = before ? mateFor(before, p.color) : null;
      const mateAfter = after ? mateFor(after, p.color) : null;
      coach[p.ply] = {
        ply: p.ply,
        explanation: null,
        bestMoveSan: row.best_move_san ? formatLine(p.ply, [row.best_move_san]) : null,
        bestMoveEval: formatScore(top?.score ?? before),
        bestMoveNote: null,
        bestLine: bestLine && bestLine.length > 1 ? formatLine(p.ply, bestLine.slice(0, 6)) : null,
        punishLine: next?.pv_san?.length ? formatLine(p.ply + 1, next.pv_san.slice(0, 6)) : null,
        punishEval: formatScore(after),
        missedMate: mateBefore !== null && mateBefore > 0 && (mateAfter === null || mateAfter <= 0),
        evalBefore: formatScore(before),
        evalAfter: formatScore(after),
        tags: [],
        maiaLine: null,
        relatedLesson: null,
      };
    }
  }

  return {
    gameId: args.gameId,
    status: args.status,
    error: args.error,
    startFen: parsed.startFen,
    myColor: args.myColor,
    analyzed,
    coach,
    plies,
  };
}
