import { Chess, type Square } from "chess.js";
import { pgnToPositions } from "../chess/pgn";
import { formatLine } from "../chess/lines";
import { formatScore, isSeverity, mateFor, sideWinPct, type Score } from "./math";
import {
  forkTargets,
  gamePhase,
  hangingPieces,
  isForkMove,
  lineHasBackRankMate,
  lineHasMate,
  materialBalance,
} from "./detectors";

/**
 * The `facts` JSON for one flagged move: the single source of truth that Jev
 * classifies and Claude explains. Every move and evaluation in here comes from
 * the engine or from deterministic code, never from a language model.
 */
export type MoveFacts = {
  ply: number;
  move_number: number;
  side: "white" | "black";
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  phase: "opening" | "middlegame" | "endgame";
  classification: "inaccuracy" | "mistake" | "miss" | "blunder";
  eval_before: string | null; // White's perspective, e.g. "+0.6"
  eval_after: string | null;
  win_pct_before: number; // mover's perspective
  win_pct_after: number;
  engine_best: { san: string | null; line: string | null; eval: string | null };
  alternatives: { san: string; line: string; eval: string | null }[];
  opponent_best_reply: { san: string | null; line: string | null; captures_moved_piece: boolean };
  clock: { left_after_move: string | null; left_before_move: string | null; time_spent: string | null };
  move: { piece: string; capture: boolean; check: boolean; castle: boolean };
  material: { before: number; after: number; after_best_reply: number | null }; // mover's view
  previous_moves: { move: string; clock: string | null }[];
  detectors: Detectors;
};

export type Detectors = {
  hanging_piece: boolean;
  hanging_piece_after_capture: boolean;
  allowed_fork: boolean;
  missed_fork: boolean;
  back_rank: boolean;
  missed_mate: boolean;
  allowed_mate_threat: boolean;
  punishment_captures_moved_piece: boolean;
};

export type PositionInput = {
  ply: number;
  eval_cp: number | null;
  eval_mate: number | null;
  classification: string | null;
  best_move_san: string | null;
  pv_san: string[] | null;
  multipv: { score: Score; pv_san: string[] }[] | null;
};

const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

function scoreOf(p: PositionInput | undefined): Score | null {
  if (!p) return null;
  if (p.eval_mate !== null) return { mate: p.eval_mate };
  if (p.eval_cp !== null) return { cp: p.eval_cp };
  return null;
}

function clock(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function buildFacts(args: { pgn: string; myColor: "white" | "black"; positions: PositionInput[] }): MoveFacts[] {
  const game = pgnToPositions(args.pgn);
  const byPly = new Map(args.positions.map((p) => [p.ply, p]));
  const mine = args.myColor === "white" ? "w" : "b";
  const opp = mine === "w" ? "b" : "w";
  const out: MoveFacts[] = [];

  for (const p of game.plies) {
    if (p.color !== mine) continue;
    const row = byPly.get(p.ply);
    if (!row || !isSeverity(row.classification)) continue;
    const before = scoreOf(byPly.get(p.ply - 1));
    const after = scoreOf(row);
    if (!before || !after) continue;

    const next = byPly.get(p.ply + 1); // its best move = opponent's best reply to my move
    const punishSan = next?.best_move_san ?? null;
    const punishLine = next?.pv_san ?? [];
    const bestLine = row.multipv?.[0]?.pv_san ?? row.pv_san ?? [];
    const bestSan = row.best_move_san;

    const moved = new Chess(p.fenBefore).move(p.san);
    const punishMove = punishSan
      ? (() => {
          try {
            return new Chess(p.fenAfter).move(punishSan);
          } catch {
            return null;
          }
        })()
      : null;

    // Hanging: something of mine hangs after the move AND the engine's reply takes it.
    const hanging = hangingPieces(p.fenAfter, mine);
    const hangingTaken = !!punishMove && punishMove.captured !== undefined && hanging.includes(punishMove.to as Square);
    const prevPly = game.plies[p.ply - 2];
    const afterCapture = moved.captured !== undefined || (!!prevPly && prevPly.san.includes("x"));

    const allowedFork = !!punishMove && forkTargets(afterMove(p.fenAfter, punishSan!), punishMove.to as Square).length >= 2;
    const mateBefore = mateFor(before, mine);
    const mateAfterForOpp = mateFor(after, opp);

    const matAfterReply = punishMove ? materialBalance(afterMove(p.fenAfter, punishSan!), mine) : null;

    const prevMoves = game.plies.slice(Math.max(0, p.ply - 4), p.ply - 1).map((q) => ({
      move: formatLine(q.ply, [q.san]),
      clock: clock(q.clockMs),
    }));
    const prevOwn = game.plies.slice(0, p.ply - 1).filter((q) => q.color === mine).at(-1);

    out.push({
      ply: p.ply,
      move_number: Math.ceil(p.ply / 2),
      side: args.myColor,
      san: p.san,
      uci: p.uci,
      fen_before: p.fenBefore,
      fen_after: p.fenAfter,
      phase: gamePhase(p.fenBefore),
      classification: row.classification,
      eval_before: formatScore(before),
      eval_after: formatScore(after),
      win_pct_before: Math.round(sideWinPct(before, mine) * 10) / 10,
      win_pct_after: Math.round(sideWinPct(after, mine) * 10) / 10,
      engine_best: {
        san: bestSan ? formatLine(p.ply, [bestSan]) : null,
        line: bestLine.length ? formatLine(p.ply, bestLine.slice(0, 6)) : null,
        eval: formatScore(row.multipv?.[0]?.score ?? before),
      },
      alternatives: (row.multipv ?? []).slice(1, 3).map((l) => ({
        san: formatLine(p.ply, l.pv_san.slice(0, 1)),
        line: formatLine(p.ply, l.pv_san.slice(0, 6)),
        eval: formatScore(l.score),
      })),
      opponent_best_reply: {
        san: punishSan ? formatLine(p.ply + 1, [punishSan]) : null,
        line: punishLine.length ? formatLine(p.ply + 1, punishLine.slice(0, 6)) : null,
        captures_moved_piece: !!punishMove && punishMove.to === moved.to && punishMove.captured !== undefined,
      },
      clock: {
        left_after_move: clock(p.clockMs),
        left_before_move: clock(prevOwn?.clockMs ?? null),
        time_spent: clock(p.timeSpentMs),
      },
      move: {
        piece: PIECE_NAME[moved.piece] ?? moved.piece,
        capture: moved.captured !== undefined,
        check: p.san.includes("+") || p.san.includes("#"),
        castle: p.san.startsWith("O-O"),
      },
      material: {
        before: materialBalance(p.fenBefore, mine),
        after: materialBalance(p.fenAfter, mine),
        after_best_reply: matAfterReply,
      },
      previous_moves: prevMoves,
      detectors: {
        hanging_piece: hangingTaken,
        hanging_piece_after_capture: hangingTaken && afterCapture,
        allowed_fork: allowedFork,
        missed_fork: isForkMove(p.fenBefore, bestSan),
        back_rank: lineHasBackRankMate(p.fenAfter, punishLine, mine),
        missed_mate: mateBefore !== null && mateBefore > 0 && !((mateFor(after, mine) ?? 0) > 0),
        allowed_mate_threat: (mateAfterForOpp !== null && mateAfterForOpp > 0) || lineHasMate(p.fenAfter, punishLine),
        punishment_captures_moved_piece: !!punishMove && punishMove.to === moved.to && punishMove.captured !== undefined,
      },
    });
  }
  return out;
}

function afterMove(fen: string, san: string): string {
  const c = new Chess(fen);
  c.move(san);
  return c.fen();
}
